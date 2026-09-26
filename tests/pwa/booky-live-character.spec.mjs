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
      stepHeld(){if(!sectionHeld)throw Error('Panel phase gate is not held');let count=0;
        for(const[id,entry]of [...sectionFrames])if(entry.native===null){count++;
          entry.native=requestAnimationFrame(time=>{sectionFrames.delete(id);entry.callback(time)})}return count},
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
    plugins: [{ name:'observe-actual-booky-walk-draw',setup(builder){
      builder.onLoad({filter:/[\\/]useBookyWalk\.ts$/},async args=>{
        const source=await fs.readFile(args.path,'utf8'),needle='point.current = sampleBookyWalk(path, progress);';
        if(source.split(needle).length!==2)throw Error('Actual Booky draw observation point changed');
        const contents=source.replace(needle,needle+'\n      window.__utilityWalkDraw?.push({ owner, time, began, progress, point: { ...point.current }, path: { from: { ...path.from }, to: { ...path.to }, direction: path.direction }, duration, recordedAt: performance.now() });');
        return{contents,loader:'ts',resolveDir:path.dirname(args.path)};
      });
    } }, { name:'observe-real-booky-ownership',setup(builder){
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
        expect([requested,cancelled]).toEqual([3,2]);
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
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/bookySurprise.ts', 'src/host/useBookyRenderer.ts', 'src/host/NativePlanetPanel.tsx',
    'src/host/host.css', 'src/host/bookyWalk.ts', 'src/host/PlanetDownloadsPanel.tsx', 'src/host/PlanetGraphicsSettings.tsx', 'src/components/RecentHistoryPanel.tsx', ASSET];
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'src/host/HostPlatformServices.ts', 'src/host/bookyMotionPreference.ts', 'src/host/useBookyWalk.ts', 'src/platform/adapters/web/WebPlatformAdapter.ts', 'tests/pwa/booky-live-character.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-independent-live-booky-character-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    fixtureObservers: ['Actual useBookyWalk sampleBookyWalk output and its source RAF time, owner, began, path and duration; read-only guarded copies only, no timing/scheduling/geometry substitution', 'Real Booky WebGLRenderer render/dispose calls, frame times, rig poses and actual scene/camera references',
      'Actual createBookyModel owner and disposer; fixture never assigns geometry or material values',
      'Delegating observer of actual native ContentDownloads methods; no replacement outcomes'],
    controlledScheduling: 'Only the three NativePlanetPanel RAF callbacks may be held/released explicitly for stale-focus regression; no globe or character clock changes',
    cameraAuthority: 'Companion show/hide/tour steps do not own the camera. Only existing canonical App navigation owns scene changes; no fixture camera assignments.',
    representation: 'Live independent Three.js character with owned geometry; original PNG only renderer-failure fallback, canonical globe unchanged',
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo, { recentHistory, allowedPreferenceKeys = [] } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'pk-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'no-preference', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'booky-live-character-fixture:1', selection: BASE });
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'], [KEY, initialRecord]]);
  if (recentHistory !== undefined) memory.set('probpera-planet-recent-adult-v1', JSON.stringify(recentHistory));
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
        expect(operations.filter(value=>value.operation!=='get'&&![BOOKY,'probpera-interface-language','probpera-planet-recent-adult-v1',...allowedPreferenceKeys].includes(value.key))).toEqual([]);
        const companionWrites=operations.filter(value=>value.operation!=='get'&&value.key===BOOKY);
        expect(companionWrites.every(value=>value.operation==='set')).toBe(true);
        for(const value of companionWrites)expect(await page.evaluate(raw=>window.__bookyLiveFixture.parseCompanion(raw),value.value)).not.toBeNull();
        result.validatedExplicitCompanionWrites=companionWrites;
        result.pass = true; },
      async close() {
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.unexpectedPreferenceWrites = operations.filter(value => value.operation !== 'get' && ![BOOKY, 'probpera-interface-language', 'probpera-planet-recent-adult-v1', ...allowedPreferenceKeys].includes(value.key));
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
    // Keep the first accepted open phase, but interrupt its deferred reveal
    // with a newer trusted touch on a compact landscape phone surface.
    await page.setViewportSize({width:568,height:320});await live(page);await stablePose(page);
    await openUtility(page,'Graphics settings','Useful actions');
    await expect(graphics).toHaveAttribute('open','');await expect(graphicsSummary).toBeFocused();
    await graphicsSummary.tap();await expect(graphics).not.toHaveAttribute('open','');await twoFrames(page);
    const interphaseOriginal=await actual(page),interphaseMutations=mutations(fixture);
    const interphaseMemory=[...fixture.memory.entries()].sort(([a],[b])=>a.localeCompare(b));
    const interphaseState=()=>page.evaluate(()=>{
      const content=document.querySelector('.native-planet-panel__content');
      const pet=document.querySelector('[data-planet-mascot-pet]');
      if(!content||!pet)throw Error('Missing actual utility surface');
      const r=pet.getBoundingClientRect();
      return{scroll:{top:content.scrollTop,left:content.scrollLeft,windowX:scrollX,windowY:scrollY},
        sections:{graphics:document.querySelector('[data-planet-graphics-settings]').open,
          downloads:document.querySelector('[data-planet-downloads]').open,recent:document.querySelector('[data-recent-history]').open},
        focusedDownloads:document.activeElement===document.querySelector('[data-planet-downloads]>summary'),
        phase:document.querySelector('[data-booky-target]')?.getAttribute('data-booky-target')??null,
        returning:pet.hasAttribute('data-booky-returning'),gesture:pet.getAttribute('data-planet-mascot-gesture'),
        pet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    });
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();
    const touchUtilities=panel(page).locator('summary').filter({hasText:/^Useful actions$/u});
    if(!await touchUtilities.evaluate(element=>element.parentElement.open))await touchUtilities.tap();
    const touchGraphicsAction=panel(page).getByRole('button',{name:'Graphics settings',exact:true});
    await touchGraphicsAction.scrollIntoViewIfNeeded();await expect(touchGraphicsAction).toBeEnabled();
    await page.evaluate(()=>window.__bookySectionFrames.hold());
    await touchGraphicsAction.tap();await expect(panel(page)).not.toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.__bookySectionFrames.pending())).toBe(1);
    expect(await page.evaluate(()=>window.__bookySectionFrames.stepHeld())).toBe(1);
    await expect(graphics).toHaveAttribute('open','');
    await expect.poll(()=>page.evaluate(()=>window.__bookySectionFrames.pending())).toBe(1);
    const interphaseOpened=await interphaseState();
    await downloadSummary.scrollIntoViewIfNeeded();
    const interphaseHit=await downloadSummary.evaluate(element=>{
      const r=element.getBoundingClientRect(),c=element.closest('.native-planet-panel__content').getBoundingClientRect();
      return{fullyInsideContent:r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right,
        reachable:[.15,.5,.85].map(fraction=>{const hit=document.elementFromPoint(r.left+r.width*fraction,r.top+r.height/2);return!!hit&&element.contains(hit);})};
    });
    expect(interphaseHit.fullyInsideContent).toBe(true);expect(interphaseHit.reachable).toEqual([true,true,true]);
    const interphaseDownloadsWereOpen=await downloads.evaluate(element=>element.open);
    await page.evaluate(()=>{
      const events=[];
      const observe=event=>{if(event.target instanceof Element&&event.target.closest('[data-planet-downloads]>summary'))
        events.push({type:event.type,trusted:event.isTrusted,pointerType:event.pointerType??null});};
      for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,observe,true);
      window.__bookyInterphaseTouch={events,stop(){for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,observe,true);return events;}};
    });
    let interphaseTouchEvents;
    try{await downloadSummary.tap();}finally{interphaseTouchEvents=await page.evaluate(()=>window.__bookyInterphaseTouch.stop());}
    for(const type of ['pointerdown','pointerup'])expect(interphaseTouchEvents.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch')).toBe(true);
    expect(interphaseTouchEvents.some(event=>event.type==='click'&&event.trusted)).toBe(true);
    await expect(downloadSummary).toBeFocused();
    expect(await downloads.evaluate(element=>element.open)).toBe(!interphaseDownloadsWereOpen);
    await twoFrames(page);
    await expect.poll(async()=>{const state=await interphaseState();return state.phase===null&&!state.returning&&state.gesture!=='walking';}).toBe(true);
    const interphaseAfterTouch=await interphaseState();
    await page.evaluate(()=>window.__bookyLiveFixture.observeWalk());
    await page.evaluate(()=>window.__bookySectionFrames.release());await twoFrames(page);
    await expect(downloadSummary).toBeFocused();
    const interphaseAfterRelease=await interphaseState();
    expect(interphaseAfterRelease.scroll).toEqual(interphaseAfterTouch.scroll);
    expect(interphaseAfterRelease.sections).toEqual(interphaseAfterTouch.sections);
    await page.waitForTimeout(1900);
    const interphaseAfter1900ms=await interphaseState();
    const interphaseMotion=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
    await expect(downloadSummary).toBeFocused();
    expect(interphaseAfter1900ms.scroll).toEqual(interphaseAfterTouch.scroll);
    expect(interphaseAfter1900ms.sections).toEqual(interphaseAfterTouch.sections);
    for(const state of [interphaseAfterRelease,interphaseAfter1900ms]){
      expect(state.phase).toBeNull();expect(state.returning).toBe(false);expect(state.gesture).not.toBe('walking');
      for(const key of ['left','top','right','bottom','width','height'])expect(Math.abs(state.pet[key]-interphaseAfterTouch.pet[key])).toBeLessThanOrEqual(.0625);
    }
    expect(interphaseMotion.samples.length).toBeGreaterThan(2);
    for(const frame of interphaseMotion.samples)for(const key of ['left','top','right','bottom','width','height'])
      expect(Math.abs(frame[key]-interphaseAfterTouch.pet[key])).toBeLessThanOrEqual(.0625);
    expect(await page.evaluate(()=>window.__bookySectionFrames.pending())).toBe(0);
    expect(mutations(fixture)).toEqual(interphaseMutations);
    expect([...fixture.memory.entries()].sort(([a],[b])=>a.localeCompare(b))).toEqual(interphaseMemory);
    expect(await downloadActions(page)).toEqual([]);retained(await actual(page),interphaseOriginal);
    result.observations.interphaseTouch={viewport:{width:568,height:320},opened:interphaseOpened,hit:interphaseHit,
      events:interphaseTouchEvents,afterTouch:interphaseAfterTouch,afterRelease:interphaseAfterRelease,after1900ms:interphaseAfter1900ms,
      motion:interphaseMotion,preferenceMemorySha256:digest(Buffer.from(JSON.stringify(interphaseMemory))),mutationsBefore:interphaseMutations};
    Object.assign(result,{newerInterphaseTouchRetained:true,interphaseTouchKeepsScrollAndSections:true,
      interphaseTouchDoesNotResumeWalk:true,interphaseTouchLandscape:true});

    result.observations.utilities={before,englishBefore,afterRandom,downloadActions:await downloadActions(page),
      savedCompanionSha256:digest(Buffer.from(saved)),countryBefore,countryAfter:new URL(page.url()).searchParams.get('country'),globe:await actual(page)};
    Object.assign(result,{scenario:'explicit-local-utilities',fourCanonicalActions:true,utilitiesBilingual:true,
      initialPanelHeadingDoesNotBlockRequestedFocus:true,utilitiesCollapseTips:true,underlyingSectionControlsUsable:true,
      newerKeyboardFocusRetained:true,staleFocusDoesNotReopenSection:true,
      openDoesNotChangeGraphicsOrDownloads:true,noUtilityProgressWrites:true,randomUsesCanonicalGlobe:true,sameCanonicalGlobe:true});
    await fixture.verify();
  }finally{await fixture.close();}
});

test('Mr. Booky fifteen gestures and nonrepeating surprises finish and remain still with reduced motion',async({},testInfo)=>{
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
      ['Dance','dance'],['Hop','hop'],['Twirl','twirl'],['Stretch','stretch'],['Act shy','shy'],['High five!','highfive'],['Take a bow','bow'],['Balance','balance']];
    const originalGestures=new Set(gestureCases.slice(0,7).map(([,interaction])=>interaction));
    await expect(panel(page).locator('[data-booky-gesture]')).toHaveCount(15);
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
      if(interaction==='bow')expect(range(values('body').map(value=>value[3]))).toBeGreaterThan(.02);
      if(interaction==='balance'){
        expect(range(values('rightLeg').map(value=>value[1]))).toBeGreaterThan(.02);
        for(const key of ['body','leftLeg','leftFoot'])expect(new Set(values(key).map(value=>JSON.stringify(value))).size).toBe(1);
      }
      if(interaction==='bow'||interaction==='balance')expect(new Set(values('rightArm').map(value=>JSON.stringify(value))).size).toBe(1);
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
    expect(newStaticPoses).toHaveLength(8);expect(new Set(newStaticPoses.map(value=>JSON.stringify(value.pose))).size).toBe(8);
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);expect(await downloadActions(page)).toEqual([]);
    retained(await actual(page),original);result.observations.explicitGestures={traces,reduced};
    Object.assign(result,{scenario:'explicit-bounded-gestures',fifteenExplicitGestures:true,repeatedReactionRestarts:true,surpriseChoosesDifferentGesture:true,
      actualRigChanges:true,eightNewMotionsObserved:true,bowAndBalanceMotionsObserved:true,newGesturesHaveDistinctStaticPoses:true,winkMovesOnlyOneEye:true,swayDoesNotStep:true,originalSevenAtMost1100ms:true,configuredReactionsAtMost2400ms:true,
      reactionsStopWithinSchedulingAllowance:true,reducedMotionHasNoReactionLoop:true,
      gesturesDoNotWritePreferencesOrProgress:true,sameCanonicalGlobe:true});await fixture.verify();
  }finally{await fixture.close();}
});


test('Mr. Booky walks continuously in clear space only by request and stops for drag, hiding and reduced motion',async({},testInfo)=>{
  test.setTimeout(150_000);const fixture=await open(testInfo),{page,result}=fixture;
  const walk=()=>page.locator('[data-booky-walk]');
  const walking=()=>expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','walking');
  const stopped=(timeout=1000)=>expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking',{timeout});
  const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
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
  const navigationSelectors=['zoom-in','zoom-out','reset','edition-info'].map(name=>'[data-globe-control="'+name+'"]')
    .concat(['.atlas-country-sheet-toggle','.atlas-immersive-chrome .interface-language-control button:first-child',
      '.atlas-immersive-chrome .interface-language-control button:last-child']);
  const navigation=()=>page.evaluate(selectors=>selectors.map(selector=>{
    const element=document.querySelector(selector),r=element?.getBoundingClientRect();
    if(!element||!r||r.width<2||r.height<2)return{selector,visible:false};
    return{selector,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,
      rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
      reachable:[.15,.5,.85].every(x=>{const hit=document.elementFromPoint(r.left+r.width*x,r.top+r.height*.5);return !!hit&&element.contains(hit);})};
  }),navigationSelectors);
  async function settlePosition(){
    let previous=null,matches=0;await expect.poll(async()=>{
      const key=JSON.stringify((await layout(page)).pet);matches=key===previous?matches+1:0;previous=key;return matches;
    },{intervals:[50,100]}).toBeGreaterThanOrEqual(3);
  }
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);
    await page.locator('[data-planet-mascot-toggle]').click();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await expect(walk()).toBeDisabled();await showWalk();
    const original=await actual(page),before=mutations(fixture),saved=fixture.memory.get(BOOKY);
    const origin=(await layout(page)).pet,desktopNavigation=await navigation();await begin();await moved(origin);
    await capture(page,result,testInfo,'booky-margin-walk-ru-1440.png');
    await stopped(6000);const complete=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
    expect(complete.samples.length).toBeGreaterThan(5);
    expect(complete.samples.every(value=>Math.abs(value.top-origin.top)<=.02),'The manual walk stays on its actual resting row').toBe(true);
    expect(Math.abs(complete.samples[0].left-origin.left),'The first frame starts at the actual resting position').toBeLessThanOrEqual(3);
    expect(complete.samples.every(value=>fits({left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height},value.viewport))).toBe(true);
    for(const target of desktopNavigation.filter(target=>target.visible))expect(complete.samples.every(sample=>!overlap(sample,target.rect)),target.selector+' stays clear for the complete walk').toBe(true);
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
    result.observations.walk={origin,desktopNavigation,complete,configuredDurationMs:duration,completedPosition,dragged,manuallyStopped,motionStoppedPosition,retired,reducedPosition};

    // A narrow portrait screen has room for a genuine touch-controlled walk.
    // Mobile claims here use native touch input, including the drag pointer.
    await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await ready(page);
    const mobileCountry=page.locator('.atlas-country-sheet-toggle');
    if(await mobileCountry.getAttribute('aria-expanded')==='true')await mobileCountry.tap();
    await expect(mobileCountry).toHaveAttribute('aria-expanded','false');await stablePose(page);
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await live(page);
    await page.locator('[data-planet-mascot-collapse]').tap();await expect(panel(page)).toHaveCount(0);await live(page);await settlePosition();
    const mobileOrigin=(await layout(page)).pet,mobileTargets=await navigation(),mobileCanonical=await actual(page),mobileBefore=mutations(fixture);
    expect(mobileTargets.every(target=>target.visible&&target.reachable)).toBe(true);await expect(walk()).toBeEnabled();
    await page.evaluate(()=>{
      window.__bookyMobileInput=[];
      for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{
        const button=event.target instanceof Element?event.target.closest('[data-booky-walk],[data-booky-walk-stop],[data-planet-mascot-move],[data-booky-reset-position]'):null;
        if(!button)return;
        const r=document.querySelector('[data-planet-mascot-pet]').getBoundingClientRect();
        window.__bookyMobileInput.push({at:performance.now(),type,pointerType:event.pointerType,trusted:event.isTrusted,
          control:button.hasAttribute('data-booky-reset-position')?'reset':button.hasAttribute('data-booky-walk-stop')?'stop':button.hasAttribute('data-booky-walk')?'start':'move',
          gesture:document.querySelector('[data-planet-mascot-pet]').getAttribute('data-planet-mascot-gesture'),left:r.left,top:r.top});
      },true);
    });
    await page.evaluate(()=>window.__bookyLiveFixture.observeWalk());await walk().tap();await walking();await moved(mobileOrigin);
    await capture(page,result,testInfo,'booky-touch-walk-ru-390.png');
    // The Stop button moves with Booky. Locator actionability would wait for
    // the walk to finish; tap its current visible point without that wait.
    const movingStop=await page.locator('[data-booky-walk-stop]').boundingBox();
    await page.touchscreen.tap(movingStop.x+movingStop.width/2,movingStop.y+movingStop.height/2);
    result.observations.mobileTouchInput=await page.evaluate(()=>window.__bookyMobileInput);
    expect(result.observations.mobileTouchInput.some(event=>event.type==='pointerdown'&&event.control==='stop'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
    expect(result.observations.mobileTouchInput.some(event=>event.type==='click'&&event.control==='stop'&&event.gesture==='walking'&&event.trusted)).toBe(true);
    await stopped();await settlePosition();
    const touchStop=(await layout(page)).pet,touchWalk=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
    expect(touchWalk.samples.length).toBeGreaterThan(5);expect(touchWalk.samples.every(sample=>Math.abs(sample.top-mobileOrigin.top)<=.02)).toBe(true);
    expect(Math.abs(touchWalk.samples[0].left-mobileOrigin.left)).toBeLessThanOrEqual(3);
    for(const target of mobileTargets)expect(touchWalk.samples.every(sample=>!overlap(sample,target.rect)),target.selector+' stays clear during touch walking').toBe(true);
    await page.waitForTimeout(350);expect((await layout(page)).pet).toEqual(touchStop);
    await walk().tap();await walking();await moved(touchStop);
    const touchHandle=await page.locator('[data-planet-mascot-move]').boundingBox(),touchStart=(await layout(page)).pet;
    const touchX=touchHandle.x+touchHandle.width/2,touchY=touchHandle.y+touchHandle.height/2,cdp=await page.context().newCDPSession(page);
    try{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY}]});
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','dragging');
      for(let step=1;step<=4;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX-30*step/4,y:touchY-20*step/4}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{await cdp.detach();}
    await stopped();await settlePosition();const touchDragged=(await layout(page)).pet;
    expect(Math.hypot(touchDragged.left-touchStart.left,touchDragged.top-touchStart.top)).toBeGreaterThan(8);
    await page.waitForTimeout(350);expect((await layout(page)).pet).toEqual(touchDragged);
    expect((await navigation()).every(target=>target.visible&&target.reachable)).toBe(true);
    result.observations.mobileTouchInput=await page.evaluate(()=>window.__bookyMobileInput);
    expect(result.observations.mobileTouchInput.some(event=>event.type==='pointerdown'&&event.control==='move'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
    expect(mutations(fixture)).toEqual(mobileBefore);retained(await actual(page),mobileCanonical);
    result.observations.mobileTouchWalk={viewport:{width:390,height:844},origin:mobileOrigin,targets:mobileTargets,touchWalk,touchStop,touchStart,touchDragged};

    // A touch begun on Stop retains that intent if the finite walk finishes
    // while the finger is still down and the same button becomes Start.
    const heldInputOffset=await page.evaluate(()=>window.__bookyMobileInput.length),heldBefore=mutations(fixture),heldSaved=fixture.memory.get(BOOKY);
    const heldCanonical=await actual(page),heldStop={viewport:{width:390,height:844}};
    result.observations.mobileHeldStop=heldStop;
    const heldState=label=>page.evaluate(label=>{
      const element=document.querySelector('[data-planet-mascot-pet]'),r=element.getBoundingClientRect();
      return{label,at:performance.now(),gesture:element.getAttribute('data-planet-mascot-gesture'),
        rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    },label);
    await expect(walk()).toBeEnabled();await walk().tap();await walking();
    await page.waitForFunction(offset=>{
      const start=window.__bookyMobileInput.slice(offset).find(event=>event.type==='click'&&event.control==='start');
      return start&&performance.now()-start.at>=3750;
    },heldInputOffset);
    heldStop.stopBox=await page.locator('[data-booky-walk-stop]').boundingBox();
    const heldCdp=await page.context().newCDPSession(page);
    try{
      await heldCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{
        x:heldStop.stopBox.x+heldStop.stopBox.width/2,y:heldStop.stopBox.y+heldStop.stopBox.height/2}]});
      await page.waitForFunction(()=>document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-planet-mascot-gesture')!=='walking',undefined,{timeout:1500});
      heldStop.beforeRelease=await heldState('naturally complete before release');
      await heldCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await twoFrames(page);
      heldStop.afterRelease=await heldState('after release');
      await page.waitForTimeout(450);heldStop.after450ms=await heldState('450ms after release');
      heldStop.input=await page.evaluate(offset=>window.__bookyMobileInput.slice(offset),heldInputOffset);
      heldStop.preferencesUnchanged=JSON.stringify(mutations(fixture))===JSON.stringify(heldBefore)&&fixture.memory.get(BOOKY)===heldSaved;
      const heldStart=heldStop.input.find(event=>event.type==='click'&&event.control==='start');
      expect(heldStop.input.some(event=>event.type==='pointerdown'&&event.control==='stop'&&event.gesture==='walking'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
      expect(heldStop.input.some(event=>event.at>=heldStop.beforeRelease.at&&event.type==='click'&&event.control==='start'&&event.gesture==='rest'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
      expect(heldStop.beforeRelease.at-heldStart.at,'The walk reaches its natural end while Stop is held').toBeGreaterThanOrEqual(3950);
      expect(heldStop.beforeRelease.gesture).toBe('rest');expect(heldStop.afterRelease.gesture).toBe('rest');expect(heldStop.after450ms.gesture).toBe('rest');
      expect(heldStop.afterRelease.rect).toEqual(heldStop.beforeRelease.rect);expect(heldStop.after450ms.rect).toEqual(heldStop.beforeRelease.rect);
      expect(heldStop.preferencesUnchanged).toBe(true);retained(await actual(page),heldCanonical);
    }finally{
      heldStop.input=await page.evaluate(offset=>window.__bookyMobileInput.slice(offset),heldInputOffset);
      await heldCdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>undefined);await heldCdp.detach();
    }

    // Reset the previously touch-dragged companion on the globe as well.
    // This runs after the held-Stop regression so its original sequence stays intact.
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);
    const resetSummary=panel(page).locator('[data-booky-useful-actions] > summary');
    if(!await resetSummary.evaluate(element=>element.parentElement.open))await resetSummary.tap();
    const globeResetBefore=mutations(fixture),globeResetSaved=fixture.memory.get(BOOKY),globeResetCanonical=await actual(page);
    const globeResetOffset=await page.evaluate(()=>window.__bookyMobileInput.length);
    const globeReset=result.observations.mobileGlobePositionReset={before:(await layout(page)).pet};
    await panel(page).locator('[data-booky-reset-position]').tap();await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);await settlePosition();
    globeReset.settled=(await layout(page)).pet;await page.waitForTimeout(350);globeReset.after350ms=(await layout(page)).pet;
    globeReset.input=await page.evaluate(offset=>window.__bookyMobileInput.slice(offset),globeResetOffset);globeReset.targets=await navigation();
    globeReset.preferencesUnchanged=JSON.stringify(mutations(fixture))===JSON.stringify(globeResetBefore)&&fixture.memory.get(BOOKY)===globeResetSaved;
    expect(globeReset.input.some(event=>event.type==='pointerdown'&&event.control==='reset'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
    expect(globeReset.input.some(event=>event.type==='click'&&event.control==='reset'&&event.pointerType==='touch'&&event.trusted)).toBe(true);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-visibility','shown');await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen','globe');
    expect(fits(globeReset.settled,{width:390,height:844})).toBe(true);expect(globeReset.after350ms).toEqual(globeReset.settled);
    expect(globeReset.targets.every(target=>target.visible&&target.reachable)).toBe(true);
    for(const target of globeReset.targets)expect(overlap(globeReset.settled,target.rect),target.selector+' remains clear after explicit reset').toBe(false);
    expect(globeReset.preferencesUnchanged).toBe(true);retained(await actual(page),globeResetCanonical);

    result.observations.compactWalk=[];
    for(const[language,size]of [['ru',{width:568,height:320}],['en',{width:568,height:320}],
      ['ru',{width:640,height:360}],['en',{width:640,height:360}]]){
      if(await page.locator('html').getAttribute('lang')!==language){
        await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:new RegExp('^'+language.toUpperCase()+'$','u')}).click();
        await expect(page.locator('html')).toHaveAttribute('lang',language);
        await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe(language);
      }
      await page.setViewportSize(size);await ready(page);
      const country=page.locator('.atlas-country-sheet-toggle');
      for(let i=0;i<3&&await country.getAttribute('aria-expanded')==='true';i++){await country.focus();await page.keyboard.press('Enter');}
      await expect(country).toHaveAttribute('aria-expanded','false');await stablePose(page);
      await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await live(page);
      await page.locator('[data-planet-mascot-collapse]').tap();await expect(panel(page)).toHaveCount(0);await live(page);await settlePosition();
      const compactOrigin=(await layout(page)).pet,targets=await navigation(),canonical=await actual(page),stored=mutations(fixture);
      expect(targets.every(target=>target.visible&&target.reachable),language+' '+size.width+' closed-help navigation is reachable').toBe(true);
      const available=await walk().isEnabled();let compactTrace;
      if(available){
        await page.evaluate(()=>window.__bookyLiveFixture.observeWalk());await walk().tap();await walking();await moved(compactOrigin);
        await capture(page,result,testInfo,`booky-clear-walk-${language}-${size.width}.png`);
        await stopped(6000);compactTrace=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
        expect(compactTrace.samples.length).toBeGreaterThan(5);
        expect(compactTrace.samples.every(sample=>Math.abs(sample.top-compactOrigin.top)<=.02)).toBe(true);
        expect(Math.abs(compactTrace.samples[0].left-compactOrigin.left)).toBeLessThanOrEqual(3);
        for(const target of targets)expect(compactTrace.samples.every(sample=>!overlap(sample,target.rect)),target.selector+' stays clear during the compact walk').toBe(true);
        expect(compactTrace.samples.every(sample=>fits(sample,sample.viewport))).toBe(true);
      }else{
        await expect(walk()).toBeDisabled();await expect(walk()).toHaveAttribute('title',language==='ru'
          ?'Пока мало свободного места для прогулки':'There is not enough clear space to walk here');
        await expect(walk()).toContainText(language==='ru'?'Мало места':'No room');
        await page.evaluate(()=>window.__bookyLiveFixture.observeWalk());
        const button=await walk().boundingBox();await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
        await page.waitForTimeout(350);await stopped();compactTrace=await page.evaluate(()=>window.__bookyLiveFixture.stopObservingWalk());
        expect(compactTrace.samples.length).toBeGreaterThan(5);
        expect(compactTrace.samples.every(sample=>sample.left===compactOrigin.left&&sample.top===compactOrigin.top)).toBe(true);
        expect((await layout(page)).pet).toEqual(compactOrigin);
        await capture(page,result,testInfo,`booky-clear-walk-${language}-${size.width}.png`);
      }
      const afterNavigation=await navigation();expect(afterNavigation.every(target=>target.visible&&target.reachable)).toBe(true);
      expect(afterNavigation.map(target=>target.rect)).toEqual(targets.map(target=>target.rect));
      expect(mutations(fixture)).toEqual(stored);retained(await actual(page),canonical);
      result.observations.compactWalk.push({language,size,available,origin:compactOrigin,targets,afterNavigation,trace:compactTrace});
    }
    Object.assign(result,{scenario:'explicit-margin-walk',explicitFiniteWalk:true,tipsRequireExplicitCollapse:true,walkFitsViewport:true,walkStartsAtRestingRow:true,walkPathAvoidsNavigation:true,actualLegsStep:true,
      compactWalkAvailabilityMatchesClearSpace:true,compactWalkKeepsNavigationReachable:true,compactUnavailableWalkExplained:true,
      mobileTouchWalkStartsContinuously:true,mobileTouchStopsWalk:true,mobileTouchDragStopsWalk:true,mobileHeldStopCannotRestart:true,
      trustedTouchGlobeResetPosition:true,globeResetPositionPreservesContext:true,
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

    const stopActivations=[];
    for(const activation of ['pointer','Enter','Space']){
      await parkAway();await observe();await openUtility(page,'Настройки графики','Полезные действия');
      await expect(target()).toHaveAttribute('data-booky-target','approaching',{timeout:2000});
      const stopButton=page.locator('[data-booky-walk-stop]');await expect(stopButton).toBeVisible();
      const states=[],stopState=async label=>{
        const state=await page.evaluate(()=>{
          const pet=document.querySelector('[data-planet-mascot-pet]'),rect=pet.getBoundingClientRect();
          return{at:performance.now(),phase:document.querySelector('[data-booky-target]')?.getAttribute('data-booky-target')??null,
            gesture:pet.getAttribute('data-planet-mascot-gesture'),buttonText:document.querySelector('.planet-mascot-controls__walk')?.textContent,
            position:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}};
        });states.push({label,...state});return state;
      };
      if(activation==='pointer'){
        const box=await stopButton.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await stopState('beforeDown');
        await page.mouse.down();await twoFrames(page);await stopState('afterDown');await page.mouse.up();
      }else{
        await stopButton.focus();await stopState('beforeDown');await page.keyboard.down(activation);
        await twoFrames(page);await stopState('afterDown');await page.keyboard.up(activation);
      }
      await twoFrames(page);const activated=await stopState('afterActivation');
      expect(activated.gesture,activation+' Stop must not start a replacement walk').not.toBe('walking');
      expect(activated.phase,activation+' Stop clears the old target').toBeNull();
      let previous=null,matches=0;
      await expect.poll(async()=>{const key=JSON.stringify((await layout(page)).pet);
        matches=key===previous?matches+1:0;previous=key;return matches;
      },{timeout:500,intervals:[30,50],message:activation+' Stop finishes its asynchronous parent position handoff'}).toBeGreaterThanOrEqual(3);
      const settled=await stopState('settled'),canonical=await actual(page);
      // Outlast both the cancelled 1600ms approach and its 700ms tap window.
      await page.waitForTimeout(2400);const future=await stopState('afterOriginalApproachAndTap');
      expect(future.position).toEqual(settled.position);expect(future.phase).toBeNull();expect(future.gesture).not.toBe('walking');
      const trace=await observation(),still=trace.samples.filter(sample=>sample.at>=settled.at);
      expect(still.length).toBeGreaterThan(2);expect(trace.clicks).toBe(0);
      expect(trace.samples.some(sample=>sample.phase==='tapping')).toBe(false);
      for(const sample of still){expect(sample.phase).toBeNull();expect(sample.gesture).not.toBe('walking');
        for(const key of ['left','top','right','bottom','width','height'])expect(sample[key]).toBe(settled.position[key]);}
      await expect(graphics()).toHaveAttribute('open','');await expect(page.locator('[data-planet-quality-option="high"]')).toBeChecked();
      expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);retained(await actual(page),canonical);
      stopActivations.push({activation,states,trace});
    }

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
    result.observations.targetApproach={complete,cancelled,reduced,stopActivations,cancelledPosition,reducedOrigin,selectedGraphicsArea,tapCue,contact,trace,
      savedCompanionSha256:digest(Buffer.from(saved)),globe:await actual(page)};
    Object.assign(result,{scenario:'explicit-target-approach',canonicalSectionOpensBeforeWalk:true,approachMovesActualPet:true,actualLegsStep:true,
      tapFollowsWalk:true,tapInsideSelectedGraphicsArea:true,targetSectionStaysOpen:true,noSyntheticTargetClick:true,approachFitsViewport:true,newKeyboardInputCancelsApproach:true,
      actualStopPointerCancelsApproach:true,actualStopEnterCancelsApproach:true,actualStopSpaceCancelsApproach:true,stopNeverStartsReplacementWalk:true,stoppedApproachRemainsStillBeyondOriginalDeadline:true,
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

    // An immediate genuine stop releases its transient position even when
    // the parent's accepted resting coordinates did not change.
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
    const collectionTargets=await collection.locator('.native-planet-panel__content button,.native-planet-panel__content summary').evaluateAll(elements=>{
      // Scrolled-out controls can still lie inside the viewport, underneath
      // the fixed header or dock. Test the actual visible scroll surface.
      const clip=document.querySelector('.native-planet-panel__content').getBoundingClientRect();
      return elements
      .filter(element=>{const r=element.getBoundingClientRect();return !element.closest('[data-planet-mascot-pet]')&&!element.disabled
        &&element.getAttribute('aria-disabled')!=='true'&&r.width>2&&r.height>2
        &&r.top>=Math.max(0,clip.top)&&r.bottom<=Math.min(innerHeight,clip.bottom)
        &&r.left>=Math.max(0,clip.left)&&r.right<=Math.min(innerWidth,clip.right)})
      .map(element=>{const path=[];let node=element;while(node&&!node.classList.contains('native-planet-panel__content')){
        path.unshift(node.tagName.toLowerCase()+':nth-child('+([...node.parentElement.children].indexOf(node)+1)+')');node=node.parentElement;}
        return'.native-planet-panel__content > '+path.join(' > ');});});
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

test('Mr. Booky treats held Enter and Space as one walking command',async({},testInfo)=>{
  test.setTimeout(90000);const fixture=await open(testInfo),{page,result}=fixture;
  const walking=()=>expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','walking');
  const stopped=()=>expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','walking');
  const observations=[];
  async function remember(label){observations.push({label,gesture:await pet(page).getAttribute('data-planet-mascot-gesture'),layout:await layout(page)});}
  async function remainsStopped(){
    await stopped();let previous=null,matches=0;
    await expect.poll(async()=>{const key=JSON.stringify((await layout(page)).pet);
      matches=key===previous?matches+1:0;previous=key;return matches;
    },{timeout:500,intervals:[30,50]}).toBeGreaterThanOrEqual(3);
    const position=(await layout(page)).pet;
    await page.waitForTimeout(4300);await stopped();expect((await layout(page)).pet).toEqual(position);
  }
  try{
    await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await stablePose(page);await page.locator('[data-planet-mascot-toggle]').click();
    await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await page.locator('[data-planet-mascot-collapse]').click();await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);
    const original=await actual(page),before=mutations(fixture),saved=fixture.memory.get(BOOKY);
    await page.evaluate(()=>{window.__bookyHeldKeys=[];document.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' ')window.__bookyHeldKeys.push({key:event.key,repeat:event.repeat});
    },true)});
    await page.locator('[data-booky-walk]').focus();
    await page.keyboard.down('Enter');await walking();await remember('Enter starts once');
    await page.keyboard.down('Enter');await twoFrames(page);await walking();await remember('Enter repeat keeps the same walk');
    await page.keyboard.up('Enter');
    await page.keyboard.down('Enter');await stopped();
    await page.keyboard.down('Enter');await twoFrames(page);await stopped();await remember('Enter repeat cannot restart after Stop');
    await page.keyboard.up('Enter');await remainsStopped();
    await page.locator('[data-booky-walk]').focus();
    await page.keyboard.down('Space');await page.keyboard.down('Space');await twoFrames(page);await stopped();
    await page.keyboard.up('Space');await walking();await remember('Held Space starts once on release');
    await page.keyboard.down('Space');await page.keyboard.down('Space');await twoFrames(page);await walking();
    await page.keyboard.up('Space');await stopped();await remainsStopped();await remember('Held Space stops once on release');
    const keys=await page.evaluate(()=>window.__bookyHeldKeys);
    expect(keys).toEqual(['Enter','Enter',' ',' '].flatMap(key=>[{key,repeat:false},{key,repeat:true}]));
    expect(mutations(fixture)).toEqual(before);expect(fixture.memory.get(BOOKY)).toBe(saved);expect(await downloadActions(page)).toEqual([]);
    retained(await actual(page),original);result.observations.heldWalkingKeys={keys,states:observations};
    Object.assign(result,{scenario:'held-walk-keyboard',heldEnterStartsOnlyOnce:true,heldEnterCannotRestartAfterStop:true,
      heldSpaceUsesOneReleaseAction:true,noHeldKeyAutomaticResume:true,noAutomaticPreferenceWrites:true,sameCanonicalGlobe:true});
    await fixture.verify();
  }catch(error){await capture(page,result,testInfo,'booky-held-key-failure.png').catch(()=>undefined);throw error;}
  finally{await page.keyboard.up('Enter').catch(()=>undefined);await page.keyboard.up('Space').catch(()=>undefined);await fixture.close();}
});

// Explicit touch-only sequences share one actual App: natural approach/point/
// return, cancelling return, resetting position, and reduced-motion pointing.
// Read-only finite observers; OS reduced-motion emulation; no app state writes.
for(const [language,view] of [['ru',{width:390,height:844}],['en',{width:320,height:844}]]){
test(`mobile touch graphics approach returns to reserved dock and respects Stop and reduced motion ${language} ${view.width}`,async({},testInfo)=>{
  test.setTimeout(120000);const fixture=await open(testInfo),{page,result}=fixture;
  result.scenario='mobile-touch-graphics-dock-return-'+language;result.observations.mobileDock={language,viewport:view};
  const all=result.observations.mobileDock;let currentRecord=null;
  const state=label=>page.evaluate(label=>window.__mobileApproach.read(label),label);
  const contains=(outer,inner)=>!!outer&&!!inner&&inner.left>=outer.left-.1&&inner.top>=outer.top-.1&&inner.right<=outer.right+.1&&inner.bottom<=outer.bottom+.1;
  const snapshotPreferences=()=>({mutations:mutations(fixture),saved:fixture.memory.get(BOOKY)});
  const unchanged=before=>JSON.stringify(mutations(fixture))===JSON.stringify(before.mutations)&&fixture.memory.get(BOOKY)===before.saved;
  async function photograph(name){if(result.screenshots.some(s=>s.filename===name))return;await capture(page,result,testInfo,name);}
  async function graphicsAction(){
    if(!await panel(page).isVisible()){await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);}
    const summary=panel(page).locator('[data-booky-useful-actions] > summary');
    if(!await summary.evaluate(element=>element.parentElement.open))await summary.tap();
    const action=panel(page).getByRole('button',{name:language==='ru'?'Настройки графики':'Graphics settings',exact:true});await expect(action).toBeEnabled();return action;
  }
  async function observe(){
    await page.evaluate(()=>{
      const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
      const visible=element=>{
        if(!element)return null;let r=element.getBoundingClientRect(),l=Math.max(0,r.left),t=Math.max(0,r.top),b=Math.min(innerHeight,r.bottom),q=Math.min(innerWidth,r.right);
        const style=getComputedStyle(element);if(element.closest('[hidden],[inert],[aria-hidden="true"]')||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||r.width<2||r.height<2)return null;let clipAncestors=style.position!=='fixed';
        for(let p=element.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),pr=p.getBoundingClientRect();
          if(s.display==='none'||Number(s.opacity)===0)return null;
          if(clipAncestors&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowX)){l=Math.max(l,pr.left);q=Math.min(q,pr.right);}
          if(clipAncestors&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowY)){t=Math.max(t,pr.top);b=Math.min(b,pr.bottom);}
          if(s.position==='fixed')clipAncestors=false;
        }
        return q-l>2&&b-t>2?{left:l,top:t,right:q,bottom:b,width:q-l,height:b-t}:null;
      };
      const check=element=>{
        const r=visible(element),key=element.querySelector('[data-planet-quality-option]')?.getAttribute('data-planet-quality-option')
          ??element.getAttribute('aria-label')??element.textContent.trim().slice(0,60);
        if(!r)return{key,visible:false};
        const points=[.15,.5,.85].map(fraction=>{const top=document.elementFromPoint(r.left+r.width*fraction,r.top+r.height/2);
          return{fraction,reachable:!!top&&element.contains(top),petBlocked:!!top?.closest('[data-planet-mascot-pet]'),hit:top?.tagName,hitClass:top?.className??null};});
        const input=element.querySelector('[data-planet-quality-option]'),ir=input&&visible(input);let inputHit=null;if(ir){const top=document.elementFromPoint(ir.left+ir.width/2,ir.top+ir.height/2);inputHit={reachable:!!top&&input.contains(top),petBlocked:!!top?.closest('[data-planet-mascot-pet]'),hit:top?.tagName,hitClass:top?.className??null};}
        return{key,visible:true,rect:r,points,inputHit,reachable:points.every(p=>p.reachable)};
      };
      const read=label=>{
        const pet=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]'),graphics=document.querySelector('[data-planet-graphics-settings]');
        const controls=[...document.querySelectorAll('.native-planet-panel__header button,[data-planet-graphics-settings] > summary,[data-planet-graphics-settings] .planet-graphics-settings__option')].map(check);
        return{at:performance.now(),label,viewport:{width:innerWidth,height:innerHeight},contentScrollTop:document.querySelector('.native-planet-panel__content')?.scrollTop??null,phase:cue?.getAttribute('data-booky-target')??null,action:cue?.getAttribute('data-booky-target-action')??null,
          returning:pet?.getAttribute('data-booky-returning')==='true',dock:visible(document.querySelector('[data-booky-dock-active="true"]')),content:visible(document.querySelector('.native-planet-panel__content')),gesture:pet?.getAttribute('data-planet-mascot-gesture')??null,visibility:pet?.getAttribute('data-planet-mascot-visibility')??null,screen:pet?.getAttribute('data-planet-mascot-screen')??null,pet:pet?rect(pet.getBoundingClientRect()):null,
          cue:cue?rect(cue.getBoundingClientRect()):null,graphicsOpen:graphics?.open??false,graphicsArea:visible(graphics?.querySelector('fieldset')),controls};
      };
      const value=window.__mobileApproach={events:[],samples:[],startedAt:performance.now(),frame:0,stopped:false,read};
      const event=event=>{const target=event.target instanceof Element?event.target:null;
        const reset=target?.closest('[data-booky-reset-position]'),r=reset?.getBoundingClientRect();
        const resetTarget=r?{rect:rect(r),reachable:[.15,.5,.85].map(fraction=>{
          const hit=document.elementFromPoint(r.left+r.width*fraction,r.top+r.height/2);return !!hit&&reset.contains(hit);
        })}:null;
        value.events.push({at:performance.now(),type:event.type,trusted:event.isTrusted,pointerType:event.pointerType??null,
          action:target?.closest('[data-planet-mascot-action]')?.getAttribute('data-planet-mascot-action')??null,
          resetTarget,control:target?.closest('[data-booky-walk-stop]')?'stop':target?.closest('[data-booky-walk]')?'start':null,state:read('input'),insideGraphics:!!target?.closest('[data-planet-graphics-settings]')});};
      for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event,true);
      const sample=()=>{if(value.stopped)return;value.samples.push(read('frame'));
        if(performance.now()-value.startedAt<10000)value.frame=requestAnimationFrame(sample);};
      value.stop=()=>{value.stopped=true;cancelAnimationFrame(value.frame);
        for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,event,true);
        return{events:value.events,samples:value.samples,startedAt:value.startedAt};};
      value.frame=requestAnimationFrame(sample);
    });
  }
  async function settle(){
    let previous=null,matches=0;await expect.poll(async()=>{const s=await state('settling'),value=JSON.stringify(s.pet);
      matches=s.phase===null&&!s.returning&&s.gesture!=='walking'&&value===previous?matches+1:0;previous=value;return matches;
    },{timeout:1500,intervals:[30,50]}).toBeGreaterThanOrEqual(3);
    return state('settled');
  }
  const finishTrace=()=>page.evaluate(()=>window.__mobileApproach.stop());
  function trustedAction(trace){expect(trace.events.some(e=>e.type==='pointerdown'&&e.action==='graphics'&&e.pointerType==='touch'&&e.trusted)).toBe(true);
    expect(trace.events.some(e=>e.type==='click'&&e.action==='graphics'&&e.pointerType==='touch'&&e.trusted)).toBe(true);
    expect(trace.events.filter(e=>e.type==='click'&&e.insideGraphics)).toEqual([]);}
  function motionMetrics(samples){
    const phases={};
    for(const name of ['approaching','tapping','returning']){const values=samples.filter(s=>name==='returning'?s.returning:s.phase===name);
      const steps=values.slice(1).map((value,i)=>({dt:value.at-values[i].at,px:Math.hypot(value.pet.left-values[i].pet.left,value.pet.top-values[i].pet.top)}));
      phases[name]={frames:values.length,first:values[0]??null,last:values.at(-1)??null,
        distance:values.length>1?Math.hypot(values.at(-1).pet.left-values[0].pet.left,values.at(-1).pet.top-values[0].pet.top):0,
        maxStep:Math.max(0,...steps.map(s=>s.px)),maxFrameGap:Math.max(0,...steps.map(s=>s.dt)),steps};
    }return phases;
  }
  function finalHitChecks(s){
    const visible=s.controls.filter(c=>c.visible);expect(visible.filter(c=>c.inputHit).length).toBeGreaterThan(0);
    expect(visible.filter(c=>!c.reachable||c.inputHit?.reachable===false),'Settled visible label/radio/header targets stay reachable').toEqual([]);
  }
  try{
    await page.setViewportSize(view);await ready(page);
    if(language==='en'){
      await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();
      await expect(page.locator('html')).toHaveAttribute('lang','en');await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe('en');
      await ready(page);
    }
    await actual(page);await stablePose(page);
    await page.evaluate(()=>window.__bookyLiveFixture.remember());
    let action=await graphicsAction();await live(page);
    const canonical=await actual(page);all.initialCanonical=canonical;
    const natural=currentRecord=all.natural={preferencesBefore:snapshotPreferences()};await observe();
    await action.tap();await expect(panel(page)).not.toBeVisible();
    await page.waitForFunction(()=>document.querySelector('[data-booky-target]')?.getAttribute('data-booky-target')==='tapping',undefined,{timeout:4000});
    natural.atPoint=await state('pointing');await photograph(`booky-mobile-graphics-approach-${language}-${view.width}.png`);
    await page.waitForFunction(()=>window.__mobileApproach.samples.some(s=>s.returning),undefined,{timeout:3000});
    await page.waitForFunction(()=>!document.querySelector('[data-booky-target]')&&document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-booky-returning')!=='true'
      &&document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-planet-mascot-gesture')!=='walking',undefined,{timeout:3500});
    natural.final=await settle();natural.trace=await finishTrace();natural.motion=motionMetrics(natural.trace.samples);
    natural.preferencesUnchanged=unchanged(natural.preferencesBefore);natural.canonical=await actual(page);
    await photograph(`booky-mobile-graphics-settled-${language}-${view.width}.png`);
    trustedAction(natural.trace);
    for(const phase of ['approaching','returning']){expect(natural.motion[phase].frames).toBeGreaterThan(2);expect(natural.motion[phase].distance).toBeGreaterThan(8);
      // Conservative screen-diagonal velocity bound catches a teleport while
      // allowing ordinary real-browser frame delays; raw deltas are retained.
      for(const step of natural.motion[phase].steps)expect(step.px).toBeLessThanOrEqual(Math.hypot(view.width,view.height)*1.5/1600*step.dt+3);}
    expect(natural.motion.tapping.frames).toBeGreaterThan(0);
    expect(natural.motion.approaching.last.at).toBeLessThan(natural.motion.tapping.first.at);
    expect(natural.motion.tapping.last.at).toBeLessThan(natural.motion.returning.first.at);
    expect(natural.motion.returning.last.at-natural.motion.approaching.first.at).toBeLessThan(5500);
    expect(natural.trace.samples.filter(s=>s.returning).every(s=>s.phase===null&&s.cue===null&&s.gesture==='walking')).toBe(true);
    const returning=natural.trace.samples.filter(s=>s.returning),tapEnd=natural.motion.tapping.last,returnStart=returning[0];
    expect(Math.hypot(returnStart.pet.left-tapEnd.pet.left,returnStart.pet.top-tapEnd.pet.top),'Return starts continuously at the pointing position').toBeLessThan(5);
    const lastReturn=returning.at(-1);expect(Math.hypot(natural.final.pet.left-lastReturn.pet.left,natural.final.pet.top-lastReturn.pet.top),'Final handoff does not teleport').toBeLessThan(5);
    expect(contains(natural.final.dock,natural.final.pet)).toBe(true);
    expect(natural.final.content.bottom,'Collection content ends above the reserved dock').toBeLessThanOrEqual(natural.final.dock.top+.1);
    expect(natural.final.pet.width).toBe(240);expect(natural.final.pet.height).toBe(96);
    finalHitChecks(natural.final);expect(natural.final.graphicsOpen).toBe(true);expect(natural.preferencesUnchanged).toBe(true);retained(natural.canonical,canonical,false);

    action=await graphicsAction();const cancelled=currentRecord=all.cancelledReturn={preferencesBefore:snapshotPreferences()};await observe();
    await action.tap();await expect(panel(page)).not.toBeVisible();
    await page.waitForFunction(()=>document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-booky-returning')==='true',undefined,{timeout:4500});
    await page.waitForTimeout(250);cancelled.beforeStop=await state('before trusted Stop');
    const button=await page.locator('[data-booky-walk-stop]').boundingBox();
    await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
    cancelled.settled=await settle();await page.waitForTimeout(1900);cancelled.after1900ms=await state('1900ms after cancelled return');
    cancelled.trace=await finishTrace();cancelled.preferencesUnchanged=unchanged(cancelled.preferencesBefore);cancelled.canonical=await actual(page);
    trustedAction(cancelled.trace);
    expect(cancelled.trace.events.some(e=>e.type==='pointerdown'&&e.control==='stop'&&e.pointerType==='touch'&&e.trusted&&e.state.returning)).toBe(true);
    expect(cancelled.trace.events.some(e=>e.type==='click'&&e.control==='stop'&&e.pointerType==='touch'&&e.trusted)).toBe(true);
    expect(cancelled.settled.returning).toBe(false);expect(cancelled.settled.phase).toBeNull();expect(cancelled.settled.gesture).not.toBe('walking');
    expect(contains(cancelled.settled.dock,cancelled.settled.pet),'Explicit Stop keeps the interrupted position outside the dock').toBe(false);
    expect(cancelled.after1900ms.pet).toEqual(cancelled.settled.pet);expect(cancelled.after1900ms.returning).toBe(false);expect(cancelled.after1900ms.phase).toBeNull();
    for(const s of cancelled.trace.samples.filter(s=>s.at>=cancelled.settled.at)){expect(s.pet).toEqual(cancelled.settled.pet);expect(s.returning).toBe(false);expect(s.phase).toBeNull();expect(s.gesture).not.toBe('walking');}
    expect(cancelled.preferencesUnchanged).toBe(true);retained(cancelled.canonical,natural.canonical);
    // Intentionally no overlap assertion after a user explicitly stops mid-route.

    // Open Useful actions without choosing graphics again. This reset is an
    // explicit instant placement change; it does not hide the companion.
    await graphicsAction();
    const resetAction=panel(page).locator('[data-booky-reset-position]');
    await expect(resetAction).toHaveText(language==='ru'?'Вернуть на место':'Return to default spot');await expect(resetAction).toBeEnabled();
    const directReset=currentRecord=all.explicitPositionReset={preferencesBefore:snapshotPreferences()};
    await observe();directReset.before=await state('before explicit position reset');
    await resetAction.tap();await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);
    directReset.settled=await settle();await page.waitForTimeout(1900);directReset.after1900ms=await state('1900ms after explicit position reset');
    directReset.trace=await finishTrace();directReset.canonical=await actual(page);
    directReset.preferenceOperations=mutations(fixture).slice(directReset.preferencesBefore.mutations.length);
    directReset.preferencesUnchanged=unchanged(directReset.preferencesBefore);
    directReset.savedBefore=JSON.parse(directReset.preferencesBefore.saved??'null');directReset.savedAfter=JSON.parse(fixture.memory.get(BOOKY)??'null');
    await photograph(`booky-mobile-position-reset-${language}-${view.width}.png`);
    const resetDown=directReset.trace.events.find(event=>event.type==='pointerdown'&&event.resetTarget&&event.pointerType==='touch'&&event.trusted);
    expect(resetDown,'The reset is activated by a trusted touch').toBeTruthy();
    expect(directReset.trace.events.some(event=>event.type==='click'&&event.resetTarget&&event.pointerType==='touch'&&event.trusted)).toBe(true);
    expect(resetDown.resetTarget.rect.width).toBeGreaterThanOrEqual(44);expect(resetDown.resetTarget.rect.height).toBeGreaterThanOrEqual(44);
    expect(resetDown.resetTarget.reachable).toEqual([true,true,true]);
    expect(directReset.trace.events.filter(event=>event.type==='click'&&(event.insideGraphics||event.action))).toEqual([]);
    expect(directReset.trace.samples.every(sample=>sample.visibility==='shown'&&sample.screen==='collection')).toBe(true);
    expect(directReset.settled.visibility).toBe('shown');expect(directReset.settled.phase).toBeNull();expect(directReset.settled.returning).toBe(false);
    expect(contains(directReset.settled.dock,directReset.settled.pet)).toBe(true);expect(directReset.settled.graphicsOpen).toBe(true);finalHitChecks(directReset.settled);
    expect(directReset.after1900ms.pet).toEqual(directReset.settled.pet);
    for(const sample of directReset.trace.samples.filter(sample=>sample.at>=directReset.settled.at)){
      expect(sample.pet).toEqual(directReset.settled.pet);expect(sample.phase).toBeNull();expect(sample.returning).toBe(false);expect(sample.gesture).not.toBe('walking');
    }
    // Panel visibility is local state. Resetting position cannot write a
    // companion record or change stored visibility/progress/preferences.
    expect(directReset.savedAfter).toEqual(directReset.savedBefore);expect(directReset.savedAfter.visible).toBe(true);
    expect(directReset.preferencesUnchanged).toBe(true);expect(directReset.preferenceOperations).toEqual([]);
    expect(directReset.canonical.quality).toBe(cancelled.canonical.quality);retained(directReset.canonical,cancelled.canonical);

    // Rotating the phone cancels old travel and reflows the reserved surface.
    action=await graphicsAction();
    const orientation=currentRecord=all.orientation={portrait:view,
      landscape:language==='ru'?{width:844,height:390}:{width:640,height:360},
      preferencesBefore:snapshotPreferences(),canonicalBefore:await actual(page),touchScroll:{gestures:[]}};
    const blocked=s=>s.controls.filter(c=>c.visible&&(!c.reachable||c.inputHit?.reachable===false));
    await observe();await action.tap();await expect(panel(page)).toHaveCount(0);
    await page.waitForFunction(()=>document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-booky-returning')==='true',undefined,{timeout:5000});
    await page.waitForTimeout(250);orientation.beforeRotation=await state('returning before rotation');
    await page.setViewportSize(orientation.landscape);await twoFrames(page);orientation.afterRotation=await state('two frames after rotation');
    await expect.poll(async()=>{const s=await state('rotation cancellation');return !s.returning&&s.phase===null&&s.gesture!=='walking';},{timeout:500,intervals:[16,32]}).toBe(true);
    orientation.settled=await settle();await page.waitForTimeout(1900);orientation.after1900ms=await state('1900ms after rotation');
    orientation.blocked=blocked(orientation.after1900ms);orientation.canonicalLandscape=await actual(page);
    // Short landscape may expose only the explanatory text. Reveal the real
    // radio targets with trusted touch, retaining scroll coordinates/results.
    for(let i=0;i<3;i++){
      const before=await state('before optional touch scroll');
      if(before.controls.some(c=>c.visible&&c.inputHit&&c.rect.height>=44))break;
      const content=before.content;
      if(!content||content.height<60)throw Error('No visible collection content area for genuine touch scroll');
      const x=content.left+content.width*.82,startY=content.bottom-24,endY=content.top+24;
      const gesture={before,x,startY,endY};orientation.touchScroll.gestures.push(gesture);
      const cdp=await page.context().newCDPSession(page);
      try{
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
        for(let step=1;step<=8;step++){const p=step/8,eased=p*p*(3-2*p);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY+(endY-startY)*eased}]});await page.waitForTimeout(25);}
        await page.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>undefined);await cdp.detach();}
      let previous=null,matches=0;await expect.poll(async()=>{const s=await state('scroll settling');matches=s.contentScrollTop===previous?matches+1:0;previous=s.contentScrollTop;return matches;},{timeout:2000,intervals:[50,75]}).toBeGreaterThanOrEqual(3);
      gesture.after=await state('after trusted touch scroll');
    }
    orientation.tested=await state('visible graphics after optional touch scroll');orientation.trace=await finishTrace();
    await photograph(`booky-rotation-landscape-${language}-${orientation.landscape.width}.png`);
    trustedAction(orientation.trace);expect(orientation.beforeRotation.returning).toBe(true);expect(orientation.beforeRotation.gesture).toBe('walking');
    expect(orientation.trace.samples.some(s=>s.phase==='approaching')).toBe(true);expect(orientation.trace.samples.some(s=>s.phase==='tapping')).toBe(true);
    expect(orientation.after1900ms.pet).toEqual(orientation.settled.pet);
    for(const s of orientation.trace.samples.filter(s=>s.at>=orientation.settled.at)){
      expect(s.pet).toEqual(orientation.settled.pet);expect(s.returning).toBe(false);expect(s.phase).toBeNull();expect(s.gesture).not.toBe('walking');
    }
    expect(fits(orientation.settled.pet,orientation.landscape)).toBe(true);expect(contains(orientation.settled.dock,orientation.settled.pet)).toBe(true);
    expect(orientation.settled.content.bottom).toBeLessThanOrEqual(orientation.settled.dock.top+.1);expect(orientation.blocked).toEqual([]);
    finalHitChecks(orientation.tested);expect(orientation.tested.controls.some(c=>c.visible&&c.inputHit&&c.rect.height>=44)).toBe(true);
    await page.setViewportSize(view);await twoFrames(page);orientation.portraitBeforeReset=await settle();
    expect(contains(orientation.portraitBeforeReset.dock,orientation.portraitBeforeReset.pet)).toBe(true);
    expect(orientation.portraitBeforeReset.content.bottom).toBeLessThanOrEqual(orientation.portraitBeforeReset.dock.top+.1);
    await graphicsAction();const rotationReset=currentRecord=orientation.explicitReset={preferencesBefore:snapshotPreferences()};
    await observe();await panel(page).locator('[data-booky-reset-position]').tap();await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);
    rotationReset.settled=await settle();await page.waitForTimeout(1900);rotationReset.after1900ms=await state('1900ms after rotation reset');
    rotationReset.trace=await finishTrace();rotationReset.canonical=await actual(page);rotationReset.preferencesUnchanged=unchanged(rotationReset.preferencesBefore);
    orientation.preferencesUnchanged=unchanged(orientation.preferencesBefore);
    await photograph(`booky-rotation-reset-${language}-${view.width}.png`);
    for(const type of ['pointerdown','click'])expect(rotationReset.trace.events.some(e=>e.type===type&&e.resetTarget&&e.pointerType==='touch'&&e.trusted)).toBe(true);
    expect(rotationReset.trace.events.filter(e=>e.type==='click'&&e.insideGraphics)).toEqual([]);
    expect(contains(rotationReset.settled.dock,rotationReset.settled.pet)).toBe(true);expect(rotationReset.settled.content.bottom).toBeLessThanOrEqual(rotationReset.settled.dock.top+.1);
    expect(rotationReset.after1900ms.pet).toEqual(rotationReset.settled.pet);expect(rotationReset.settled.visibility).toBe('shown');finalHitChecks(rotationReset.after1900ms);
    for(const s of rotationReset.trace.samples.filter(s=>s.at>=rotationReset.settled.at)){
      expect(s.pet).toEqual(rotationReset.settled.pet);expect(s.returning).toBe(false);expect(s.phase).toBeNull();expect(s.gesture).not.toBe('walking');
    }
    expect(orientation.preferencesUnchanged).toBe(true);expect(rotationReset.preferencesUnchanged).toBe(true);
    retained(orientation.canonicalLandscape,orientation.canonicalBefore,false);retained(rotationReset.canonical,orientation.canonicalBefore,false);
    Object.assign(result,{trustedTouchGraphicsThenRotation:true,orientationCancelsReturn:true,noAutomaticReturnResume:true,
      rotatedCompanionFitsViewport:true,orientationRetainsDockContainment:true,orientationContentExcludesDock:true,
      rotatedVisibleGraphicsControlsReachable:true,touchScrollExposesGraphicsTargets:true,portraitReflowBeforeResetFitsDock:true,
      explicitResetAfterRotationReturnsToDock:true});

    const resetBefore=mutations(fixture);await page.locator('[data-planet-mascot-hide]').tap();
    await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(false);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await page.locator('[data-planet-mascot-collapse]').tap();await expect(panel(page)).toHaveCount(0);await companionSaved(fixture);
    await observe();all.resetToDock={state:await settle(),explicitPreferenceOperations:mutations(fixture).slice(resetBefore.length)};await finishTrace();
    action=await graphicsAction();const reduced=currentRecord=all.reducedMotion={preferencesBefore:snapshotPreferences()};await observe();reduced.origin=await state('before reduced-motion action');
    await action.tap();await expect(panel(page)).not.toBeVisible();
    await page.waitForFunction(()=>document.querySelector('[data-booky-target]')?.getAttribute('data-booky-target')==='tapping',undefined,{timeout:1500});
    reduced.atPoint=await state('static pointing');await page.waitForTimeout(1000);reduced.final=await settle();reduced.trace=await finishTrace();
    reduced.preferencesUnchanged=unchanged(reduced.preferencesBefore);reduced.canonical=await actual(page);
    trustedAction(reduced.trace);expect(reduced.trace.samples.some(s=>s.phase==='tapping'&&s.gesture==='pointing')).toBe(true);
    expect(reduced.trace.samples.some(s=>s.phase==='approaching'||s.returning||s.gesture==='walking')).toBe(false);
    expect(contains(reduced.atPoint.dock,reduced.atPoint.pet)).toBe(true);expect(contains(reduced.final.dock,reduced.final.pet)).toBe(true);
    for(const s of reduced.trace.samples)expect(s.pet).toEqual(reduced.origin.pet);
    expect(reduced.final.pet).toEqual(reduced.origin.pet);finalHitChecks(reduced.final);
    expect(reduced.preferencesUnchanged).toBe(true);retained(reduced.canonical,cancelled.canonical);
    Object.assign(result,{trustedTouchUtilityOpens:true,mobileApproachAndReturnFinite:true,mobileReturnContinuous:true,mobileNaturalReturnStaysInReservedDock:true,
      finalGraphicsControlsReachable:true,collectionContentExcludesDock:true,trustedTouchStopCancelsReturn:true,stoppedReturnRemainsStill:true,
      trustedTouchResetPosition:true,resetPositionControlReachable:true,resetPositionKeepsVisible:true,resetPositionReturnsToDock:true,
      resetPositionRemainsStill:true,resetPositionPreservesPreferencesAndProgress:true,resetPositionPreservesContext:true,
      reducedMotionPointsFromDockWithoutTravel:true,noAutomaticPreferenceWrites:true,sameCanonicalGlobe:true});
    await fixture.verify();
  }finally{
    const trace=await finishTrace().catch(()=>null);if(trace&&currentRecord&&!currentRecord.trace)currentRecord.trace=trace;
    await photograph(`booky-mobile-graphics-approach-${language}-${view.width}.png`).catch(()=>undefined);
    await photograph(`booky-mobile-graphics-settled-${language}-${view.width}.png`).catch(()=>undefined);
    await fixture.close();
  }
});
}


for(const [language,view] of [['ru',{width:390,height:844}],['en',{width:320,height:844}]])for(const action of ['recent','downloads']){
  test('utility surface natural touch '+language+' '+action,async({},testInfo)=>{
    test.setTimeout(120000);
    const fixture=await open(testInfo,{recentHistory:{v:1,entries:[{kind:'writer',countryId:'russia',writerId:'dostoevsky',openedAt:1789660800000}]}}),{page,result}=fixture;
    const o=result.observations.utilitySurface={language,view,action,checks:[],findings:[]};
    result.scenario='utility-surface-'+language+'-'+action;
    const targetSelector=action==='recent'?'[data-recent-history]':'[data-planet-downloads]';
    const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message});o.findings.push({name,error:error.message});}};
    const preferences=()=>({entries:[...fixture.memory.entries()].sort(([a],[b])=>a.localeCompare(b)),mutations:mutations(fixture)});
    const state=label=>page.evaluate(label=>window.__utilitySurface.read(label),label);
    try{
      await page.setViewportSize(view);await ready(page);
      if(language==='en'){
        await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();
        await expect(page.locator('html')).toHaveAttribute('lang','en');
        await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe('en');await ready(page);
      }
      await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
      o.canonicalBefore=await actual(page);
      await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);
      const useful=panel(page).locator('[data-booky-useful-actions] > summary');
      if(!await useful.evaluate(element=>element.parentElement.open))await useful.tap();
      const selected=panel(page).locator('[data-planet-mascot-action="'+action+'"]');
      await expect(selected).toBeEnabled();await selected.scrollIntoViewIfNeeded();await live(page);
      expect(await page.locator('[data-planet-graphics-settings]').evaluateAll(nodes=>nodes.some(node=>node.open))).toBe(false);
      // The original fixture supplies real native preference bindings and canonical catalog loading.
      // No target, position, open flag, source geometry, motion clock or preference is assigned here.
      await page.evaluate(({action,targetSelector})=>{
        const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
        const visible=element=>{
          if(!element)return null;const r=element.getBoundingClientRect(),style=getComputedStyle(element);
          if(element.closest('[hidden],[inert],[aria-hidden="true"]')||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||r.width<2||r.height<2)return null;
          let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom),clip=style.position!=='fixed';
          for(let p=element.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if(s.display==='none'||Number(s.opacity)===0)return null;
            if(clip&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}
            if(clip&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
            if(s.position==='fixed')clip=false;
          }
          return right-left>=2&&bottom-top>=2?{left,top,right,bottom,width:right-left,height:bottom-top}:null;
        };
        const check=(element,index)=>{
          const raw=rect(element.getBoundingClientRect()),r=visible(element);
          const key=element.getAttribute('aria-label')||element.getAttribute('data-recent-entry')||element.textContent.trim().replace(/\s+/gu,' ').slice(0,100)||element.tagName;
          if(!r)return{index,key,tag:element.tagName,visibility:'none',raw};
          const full=Object.keys(r).every(key=>Math.abs(r[key]-raw[key])<.5);
          const points=[.15,.5,.85].map(fraction=>{const x=r.left+r.width*fraction,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
            return{x,y,fraction,reachable:!!hit&&element.contains(hit),petBlocked:!!hit?.closest('[data-planet-mascot-pet]'),hit:hit?.tagName??null,hitClass:typeof hit?.className==='string'?hit.className:null};});
          return{index,key,tag:element.tagName,recentEntry:element.getAttribute('data-recent-entry'),inputType:element.getAttribute('type'),visibility:full?'full':'partial',raw,rect:r,disabled:element.matches(':disabled')||element.getAttribute('aria-disabled')==='true',points,reachable:points.every(point=>point.reachable)};
        };
        const read=(label,rafAt=null)=>{const readStart=performance.now();const p=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]'),target=document.querySelector(targetSelector);
          const prose=[...(target?.querySelectorAll('p,h3,.recent-history__label,.recent-history__kind')??[])].map((element,index)=>({index,text:element.textContent.trim().replace(/\s+/gu,' ').slice(0,160),raw:rect(element.getBoundingClientRect()),visible:visible(element)}));
          const controls=[...document.querySelectorAll('.native-planet-panel__header button,'+targetSelector+' summary,'+targetSelector+' button,'+targetSelector+' a[href],'+targetSelector+' input,'+targetSelector+' select,'+targetSelector+' label')].map(check);
          return{at:performance.now(),readStart,readEnd:performance.now(),rafAt,label,viewport:{width:innerWidth,height:innerHeight},pet:p?rect(p.getBoundingClientRect()):null,
            phase:cue?.getAttribute('data-booky-target')??null,action:cue?.getAttribute('data-booky-target-action')??null,returning:p?.getAttribute('data-booky-returning')==='true',gesture:p?.getAttribute('data-planet-mascot-gesture')??null,
            targetOpen:target?.open??false,target:target?{raw:rect(target.getBoundingClientRect()),visible:visible(target)}:null,
            graphicsOpen:document.querySelector('[data-planet-graphics-settings]')?.open??false,dockActive:document.querySelector('[data-booky-dock-active="true"]')!==null,
            dock:visible(document.querySelector('[data-booky-dock-active="true"]')),content:visible(document.querySelector('.native-planet-panel__content')),prose,
            contentScrollTop:document.querySelector('.native-planet-panel__content')?.scrollTop??null,controls};};
        const readFrame=rafAt=>{
          const readStart=performance.now(),p=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]');
          const value={rafAt,readStart,viewport:{width:innerWidth,height:innerHeight},pet:p?rect(p.getBoundingClientRect()):null,
            phase:cue?.getAttribute('data-booky-target')??null,action:cue?.getAttribute('data-booky-target-action')??null,
            returning:p?.getAttribute('data-booky-returning')==='true',gesture:p?.getAttribute('data-planet-mascot-gesture')??null};
          value.readEnd=performance.now();value.at=value.readEnd;return value;
        };
        window.__utilityWalkDraw=[];
        const value=window.__utilitySurface={samples:[],events:[],frame:0,stopped:false,startedAt:performance.now(),read};
        const event=e=>{const target=e.target instanceof Element?e.target:null;
          value.events.push({at:performance.now(),type:e.type,trusted:e.isTrusted,pointerType:e.pointerType??null,key:e.key??null,
            action:target?.closest('[data-planet-mascot-action]')?.getAttribute('data-planet-mascot-action')??null,insideTarget:!!target?.closest(targetSelector)});};
        for(const type of ['pointerdown','pointerup','click','keydown'])document.addEventListener(type,event,true);
        const frame=rafAt=>{if(value.stopped)return;value.samples.push(readFrame(rafAt));if(performance.now()-value.startedAt<12000)value.frame=requestAnimationFrame(frame);};
        value.stop=()=>{value.stopped=true;cancelAnimationFrame(value.frame);for(const type of ['pointerdown','pointerup','click','keydown'])document.removeEventListener(type,event,true);return{startedAt:value.startedAt,samples:value.samples,events:value.events,draws:window.__utilityWalkDraw??[]};};
        value.frame=requestAnimationFrame(frame);
      },{action,targetSelector});
      o.before=await state('before explicit touch');o.preferencesBefore=preferences();o.downloadCallsBefore=await downloadActions(page);
      await selected.tap();await expect(panel(page)).not.toBeVisible();await expect(page.locator(targetSelector)).toHaveAttribute('open','');
      await checked('natural point reached',()=>expect.poll(()=>page.evaluate(()=>window.__utilitySurface.samples.some(s=>s.phase==='tapping')),{timeout:6000,intervals:[30,50]}).toBe(true));
      await checked('natural return reached',()=>expect.poll(()=>page.evaluate(()=>window.__utilitySurface.samples.some(s=>s.returning)),{timeout:2500,intervals:[30,50]}).toBe(true));
      let previous=null,matches=0;
      await checked('natural point completed and position settled',()=>expect.poll(async()=>{const s=await state('settling'),key=JSON.stringify(s.pet);matches=s.phase===null&&!s.returning&&s.gesture!=='walking'&&key===previous?matches+1:0;previous=key;return matches;},{timeout:2500,intervals:[30,50]}).toBeGreaterThanOrEqual(3));
      o.settled=await state('settled');await page.waitForTimeout(1900);o.after1900ms=await state('after 1900ms');
      o.trace=await page.evaluate(()=>window.__utilitySurface.stop());
      o.preferencesAfter=preferences();o.downloadCallsAfter=await downloadActions(page);o.canonicalAfter=await actual(page);
      await capture(page,result,testInfo,'booky-utility-'+action+'-'+language+'-'+view.width+'.png');
      await checked('explicit trusted touch action',()=>{for(const type of ['pointerdown','click'])expect(o.trace.events.some(e=>e.type===type&&e.action===action&&e.trusted&&e.pointerType==='touch')).toBe(true);expect(o.trace.events.filter(e=>e.type==='click'&&e.insideTarget)).toEqual([]);});
      await checked('graphics closed and whole companion in measured dock',()=>{
        const s=o.after1900ms;expect(o.before.graphicsOpen).toBe(false);expect(s.graphicsOpen).toBe(false);expect(s.dockActive).toBe(true);
        expect(s.pet.width).toBe(240);expect(s.pet.height).toBe(96);expect(s.dock.height).toBe(120);
        expect(s.pet.left>=s.dock.left-.1&&s.pet.top>=s.dock.top-.1&&s.pet.right<=s.dock.right+.1&&s.pet.bottom<=s.dock.bottom+.1).toBe(true);
        expect(s.content.bottom).toBeLessThanOrEqual(s.dock.top+.1);
      });
      await checked('finite approach point return and continuous handoff',()=>{
        const phases={};for(const name of ['approaching','tapping','returning'])phases[name]=o.trace.samples.filter(s=>name==='returning'?s.returning:s.phase===name);
        o.phaseMetrics=Object.fromEntries(Object.entries(phases).map(([name,samples])=>[name,{frames:samples.length,first:samples[0]??null,last:samples.at(-1)??null}]));
        const drawOwners=[...new Set(o.trace.draws.map(d=>d.owner))];expect(drawOwners).toHaveLength(2);o.motionProvenance={};
        for(const name of ['approaching','returning']){
          const samples=phases[name];expect(samples.length).toBeGreaterThan(2);
          expect(Math.hypot(samples.at(-1).pet.left-samples[0].pet.left,samples.at(-1).pet.top-samples[0].pet.top)).toBeGreaterThan(8);
          const owner=drawOwners[name==='approaching'?0:1],authored=o.trace.draws.filter(d=>d.owner===owner),first=authored[0];
          expect(first.duration).toBe(1600);expect(authored.every(d=>d.duration===first.duration&&d.began===first.began&&JSON.stringify(d.path)===JSON.stringify(first.path))).toBe(true);
          const candidates=[{...first,time:first.began,progress:0,point:first.path.from,recordedAt:first.began,initial:true},...authored];
          let priorTime=first.began;const matched=[];
          for(const [index,s] of samples.entries()){
            const choices=candidates.filter(d=>d.time>=priorTime&&d.recordedAt<=s.readEnd+.001&&Math.abs(d.point.left-s.pet.left)<=1/32&&Math.abs(d.point.top-s.pet.top)<=1/32)
              .sort((a,b)=>Math.hypot(a.point.left-s.pet.left,a.point.top-s.pet.top)-Math.hypot(b.point.left-s.pet.left,b.point.top-s.pet.top)||a.time-b.time);
            expect(choices.length,'Every moving DOM sample matches current owner/path draw, including initial path.from').toBeGreaterThan(0);
            const d=choices[0];priorTime=d.time;matched.push({index,owner,sourceTime:d.time,sourceProgress:d.progress,sourcePoint:d.point,initial:d.initial===true,observerRafAt:s.rafAt,readStart:s.readStart,readEnd:s.readEnd,pet:s.pet});
          }
          const observerIntervals=[];
          for(let i=1;i<matched.length;i++){
            const a=matched[i-1],b=matched[i],px=Math.hypot(b.pet.left-a.pet.left,b.pet.top-a.pet.top),sourceDt=b.sourceTime-a.sourceTime;
            expect(sourceDt).toBeGreaterThanOrEqual(0);expect(px).toBeLessThanOrEqual(Math.hypot(view.width,view.height)*1.5/1600*sourceDt+3);
            const rafDt=b.observerRafAt-a.observerRafAt,readDt=b.readEnd-a.readEnd,bound=Math.hypot(view.width,view.height)*1.5/1600*rafDt+3;
            observerIntervals.push({index:i,px,sourceDt,rafDt,readDt,observerBound:bound,observerBoundExceeded:px>bound});
          }
          o.motionProvenance[name]={owner,path:first.path,began:first.began,duration:first.duration,roundingTolerance:1/32,matched,observerIntervals,
            maxReadCostMs:Math.max(...samples.map(s=>s.readEnd-s.readStart)),observerIntervalViolations:observerIntervals.filter(s=>s.observerBoundExceeded)};
        }
        expect(phases.tapping.length).toBeGreaterThan(0);
        expect(phases.approaching.at(-1).at).toBeLessThan(phases.tapping[0].at);expect(phases.tapping.at(-1).at).toBeLessThan(phases.returning[0].at);
        expect(phases.returning.at(-1).at-phases.approaching[0].at).toBeLessThan(5500);
        for(const s of phases.returning){expect(s.phase).toBeNull();expect(s.gesture).toBe('walking');}
        const a=phases.tapping.at(-1),b=phases.returning[0],c=phases.returning.at(-1);
        expect(Math.hypot(b.pet.left-a.pet.left,b.pet.top-a.pet.top)).toBeLessThan(5);
        expect(Math.hypot(o.settled.pet.left-c.pet.left,o.settled.pet.top-c.pet.top)).toBeLessThan(5);
      });
      await checked('visible body prose clear after natural return',()=>{
        const s=o.after1900ms,visible=s.prose.filter(item=>item.visible);expect(visible.length).toBeGreaterThan(0);
        const overlaps=r=>Math.min(r.right,s.pet.right)>Math.max(r.left,s.pet.left)+.1&&Math.min(r.bottom,s.pet.bottom)>Math.max(r.top,s.pet.top)+.1;
        o.obstructedProse=visible.filter(item=>overlaps(item.visible));expect(o.obstructedProse).toEqual([]);
      });
      await checked('whole pet stays in viewport',()=>{expect(fits(o.after1900ms.pet,o.after1900ms.viewport)).toBe(true);expect(o.trace.samples.filter(s=>s.pet).every(s=>fits(s.pet,s.viewport))).toBe(true);});
      await checked('1900ms exact stillness and no automatic resume',()=>{expect(o.after1900ms.at-o.settled.at).toBeGreaterThanOrEqual(1900);expect(o.after1900ms.pet).toEqual(o.settled.pet);for(const s of o.trace.samples.filter(s=>s.at>=o.settled.at)){expect(s.pet).toEqual(o.settled.pet);expect(s.phase).toBeNull();expect(s.returning).toBe(false);expect(s.gesture).not.toBe('walking');}});
      await checked('required section controls are actually visible',()=>{const visible=o.after1900ms.controls.filter(c=>c.visibility!=='none');if(action==='recent')expect(visible.some(c=>c.recentEntry)).toBe(true);else{expect(visible.some(c=>c.tag==='INPUT'&&c.inputType==='checkbox')).toBe(true);expect(visible.some(c=>c.tag==='LABEL')).toBe(true);}});
      await checked('visible section and header hit points',()=>{const visible=o.after1900ms.controls.filter(c=>c.visibility!=='none');expect(visible.length).toBeGreaterThan(3);expect(visible.filter(c=>!c.reachable)).toEqual([]);});
      await checked('preferences and progress bytes unchanged',()=>expect(o.preferencesAfter).toEqual(o.preferencesBefore));
      await checked('no automatic download action',()=>expect(o.downloadCallsAfter).toEqual(o.downloadCallsBefore));
      await checked('canonical scene camera resources unchanged',()=>retained(o.canonicalAfter,o.canonicalBefore));
      await checked('actual App fixture integrity',()=>fixture.verify());
      result.pass=o.findings.length===0;result.observationsComplete=true;
      expect(o.findings,'All independent observations are preserved before this summary assertion').toEqual([]);
    }catch(error){
      result.pass=false;o.failure=error.message;
      if(!o.trace)o.trace=await page.evaluate(()=>window.__utilitySurface?.stop()??null).catch(()=>null);
      if(!result.screenshots.length)await capture(page,result,testInfo,'booky-utility-'+action+'-'+language+'-'+view.width+'.png').catch(()=>undefined);
      throw error;
    }finally{await fixture.close();}
  });
}


for(const [language,view,action] of [['ru',{width:568,height:320},'recent'],['en',{width:640,height:360},'downloads']]){
  test('utility landscape natural touch '+language+' '+action,async({},testInfo)=>{
    test.setTimeout(120000);
    const fixture=await open(testInfo,{recentHistory:{v:1,entries:[{kind:'writer',countryId:'russia',writerId:'dostoevsky',openedAt:1789660800000}]}}),{page,result}=fixture;
    const o=result.observations.utilitySurface={language,view,action,checks:[],findings:[]};
    result.scenario='utility-landscape-'+language+'-'+action;
    const targetSelector=action==='recent'?'[data-recent-history]':'[data-planet-downloads]';
    const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message});o.findings.push({name,error:error.message});}};
    const preferences=()=>({entries:[...fixture.memory.entries()].sort(([a],[b])=>a.localeCompare(b)),mutations:mutations(fixture)});
    const state=label=>page.evaluate(label=>window.__utilitySurface.read(label),label);
    try{
      await page.setViewportSize(view);await ready(page);
      if(language==='en'){
        await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();
        await expect(page.locator('html')).toHaveAttribute('lang','en');
        await expect.poll(()=>fixture.memory.get('probpera-interface-language')).toBe('en');await ready(page);
      }
      await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
      o.canonicalBefore=await actual(page);
      await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);
      const useful=panel(page).locator('[data-booky-useful-actions] > summary');
      if(!await useful.evaluate(element=>element.parentElement.open))await useful.tap();
      const selected=panel(page).locator('[data-planet-mascot-action="'+action+'"]');
      await expect(selected).toBeEnabled();await selected.scrollIntoViewIfNeeded();await live(page);
      expect(await page.locator('[data-planet-graphics-settings]').evaluateAll(nodes=>nodes.some(node=>node.open))).toBe(false);
      // The original fixture supplies real native preference bindings and canonical catalog loading.
      // No target, position, open flag, source geometry, motion clock or preference is assigned here.
      await page.evaluate(({action,targetSelector})=>{
        const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
        const visible=element=>{
          if(!element)return null;const r=element.getBoundingClientRect(),style=getComputedStyle(element);
          if(element.closest('[hidden],[inert],[aria-hidden="true"]')||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||r.width<2||r.height<2)return null;
          let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom),clip=style.position!=='fixed';
          for(let p=element.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if(s.display==='none'||Number(s.opacity)===0)return null;
            if(clip&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}
            if(clip&&p!==document.body&&p!==document.documentElement&&/auto|scroll|hidden|clip/u.test(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
            if(s.position==='fixed')clip=false;
          }
          return right-left>=2&&bottom-top>=2?{left,top,right,bottom,width:right-left,height:bottom-top}:null;
        };
        const check=(element,index)=>{
          const raw=rect(element.getBoundingClientRect()),r=visible(element);
          const key=element.getAttribute('aria-label')||element.getAttribute('data-recent-entry')||element.textContent.trim().replace(/\s+/gu,' ').slice(0,100)||element.tagName;
          if(!r)return{index,key,tag:element.tagName,recentEntry:element.getAttribute('data-recent-entry'),inputType:element.getAttribute('type'),visibility:'none',raw};
          const full=Object.keys(r).every(key=>Math.abs(r[key]-raw[key])<.5);
          const points=[.15,.5,.85].map(fraction=>{const x=r.left+r.width*fraction,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
            return{x,y,fraction,reachable:!!hit&&element.contains(hit),petBlocked:!!hit?.closest('[data-planet-mascot-pet]'),hit:hit?.tagName??null,hitClass:typeof hit?.className==='string'?hit.className:null};});
          return{index,key,tag:element.tagName,recentEntry:element.getAttribute('data-recent-entry'),inputType:element.getAttribute('type'),visibility:full?'full':'partial',raw,rect:r,disabled:element.matches(':disabled')||element.getAttribute('aria-disabled')==='true',points,reachable:points.every(point=>point.reachable)};
        };
        const read=(label,rafAt=null)=>{const readStart=performance.now();const p=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]'),target=document.querySelector(targetSelector);
          const prose=[...(target?.querySelectorAll('p,h3,.recent-history__label,.recent-history__kind')??[])].map((element,index)=>({index,text:element.textContent.trim().replace(/\s+/gu,' ').slice(0,160),raw:rect(element.getBoundingClientRect()),visible:visible(element)}));
          const controls=[...document.querySelectorAll('.native-planet-panel__header button,'+targetSelector+' summary,'+targetSelector+' button,'+targetSelector+' a[href],'+targetSelector+' input,'+targetSelector+' select,'+targetSelector+' label')].map(check);
          return{at:performance.now(),readStart,readEnd:performance.now(),rafAt,label,viewport:{width:innerWidth,height:innerHeight},pet:p?rect(p.getBoundingClientRect()):null,
            phase:cue?.getAttribute('data-booky-target')??null,action:cue?.getAttribute('data-booky-target-action')??null,returning:p?.getAttribute('data-booky-returning')==='true',gesture:p?.getAttribute('data-planet-mascot-gesture')??null,
            targetOpen:target?.open??false,target:target?{raw:rect(target.getBoundingClientRect()),visible:visible(target)}:null,
            graphicsOpen:document.querySelector('[data-planet-graphics-settings]')?.open??false,dockActive:document.querySelector('[data-booky-dock-active="true"]')!==null,
            dock:visible(document.querySelector('[data-booky-dock-active="true"]')),content:visible(document.querySelector('.native-planet-panel__content')),prose,
            contentScrollTop:document.querySelector('.native-planet-panel__content')?.scrollTop??null,controls};};
        const readFrame=rafAt=>{
          const readStart=performance.now(),p=document.querySelector('[data-planet-mascot-pet]'),cue=document.querySelector('[data-booky-target]');
          const value={rafAt,readStart,viewport:{width:innerWidth,height:innerHeight},pet:p?rect(p.getBoundingClientRect()):null,
            phase:cue?.getAttribute('data-booky-target')??null,action:cue?.getAttribute('data-booky-target-action')??null,
            returning:p?.getAttribute('data-booky-returning')==='true',gesture:p?.getAttribute('data-planet-mascot-gesture')??null};
          value.readEnd=performance.now();value.at=value.readEnd;return value;
        };
        window.__utilityWalkDraw=[];
        const value=window.__utilitySurface={samples:[],events:[],frame:0,stopped:false,startedAt:performance.now(),read};
        const event=e=>{const target=e.target instanceof Element?e.target:null;
          value.events.push({at:performance.now(),type:e.type,trusted:e.isTrusted,pointerType:e.pointerType??null,key:e.key??null,
            action:target?.closest('[data-planet-mascot-action]')?.getAttribute('data-planet-mascot-action')??null,insideTarget:!!target?.closest(targetSelector),insideContent:!!target?.closest('.native-planet-panel__content')});};
        for(const type of ['pointerdown','pointerup','click','keydown','touchstart','touchmove','touchend'])document.addEventListener(type,event,true);
        const frame=rafAt=>{if(value.stopped)return;value.samples.push(readFrame(rafAt));if(performance.now()-value.startedAt<18000)value.frame=requestAnimationFrame(frame);};
        value.stop=()=>{value.stopped=true;cancelAnimationFrame(value.frame);for(const type of ['pointerdown','pointerup','click','keydown','touchstart','touchmove','touchend'])document.removeEventListener(type,event,true);return{startedAt:value.startedAt,samples:value.samples,events:value.events,draws:window.__utilityWalkDraw??[]};};
        value.frame=requestAnimationFrame(frame);
      },{action,targetSelector});
      o.before=await state('before explicit touch');o.preferencesBefore=preferences();o.downloadCallsBefore=await downloadActions(page);
      await selected.tap();await expect(panel(page)).not.toBeVisible();await expect(page.locator(targetSelector)).toHaveAttribute('open','');
      await checked('natural point reached',()=>expect.poll(()=>page.evaluate(()=>window.__utilitySurface.samples.some(s=>s.phase==='tapping')),{timeout:6000,intervals:[30,50]}).toBe(true));
      await checked('natural return reached',()=>expect.poll(()=>page.evaluate(()=>window.__utilitySurface.samples.some(s=>s.returning)),{timeout:2500,intervals:[30,50]}).toBe(true));
      let previous=null,matches=0;
      await checked('natural point completed and position settled',()=>expect.poll(async()=>{const s=await state('settling'),key=JSON.stringify(s.pet);matches=s.phase===null&&!s.returning&&s.gesture!=='walking'&&key===previous?matches+1:0;previous=key;return matches;},{timeout:2500,intervals:[30,50]}).toBeGreaterThanOrEqual(3));
      o.settled=await state('settled before optional user scroll');
      await capture(page,result,testInfo,'booky-utility-landscape-'+action+'-'+language+'-'+view.width+'-natural-return.png');
      o.touchScroll={gestures:[],requiredVisibleInitially:false};
      const requiredControls=s=>s.controls.filter(c=>action==='recent'?c.recentEntry:(c.tag==='INPUT'&&c.inputType==='checkbox')||c.tag==='LABEL');
      const exposed=s=>{const controls=requiredControls(s);return controls.length>=(action==='recent'?1:2)&&controls.every(c=>c.visibility==='full'&&c.reachable);};
      o.touchScroll.requiredVisibleInitially=exposed(o.settled);
      await checked('required utility controls exposed by optional trusted touch scroll',async()=>{
        for(let attempt=0;attempt<6;attempt++){
          const before=await state('before optional touch scroll');if(exposed(before))break;
          const content=before.content,targets=requiredControls(before);
          expect(content?.height,'Visible panel clip can receive user scroll').toBeGreaterThan(48);
          expect(targets.length).toBeGreaterThanOrEqual(action==='recent'?1:2);
          const targetTop=Math.min(...targets.map(c=>c.raw.top)),targetBottom=Math.max(...targets.map(c=>c.raw.bottom));
          const direction=(targetTop+targetBottom)/2>(content.top+content.bottom)/2?1:-1;
          const x=content.left+content.width*.92,startY=direction>0?content.bottom-12:content.top+12,endY=direction>0?content.top+12:content.bottom-12;
          const hit=await page.evaluate(({x,y})=>{const h=document.elementFromPoint(x,y);return{insideContent:!!h?.closest('.native-planet-panel__content'),pet:!!h?.closest('[data-planet-mascot-pet]')};},{x,y:startY});
          expect(hit).toEqual({insideContent:true,pet:false});
          const gesture={before,x,startY,endY,direction};o.touchScroll.gestures.push(gesture);
          const cdp=await page.context().newCDPSession(page);
          try{
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
            for(let step=1;step<=8;step++){const p=step/8,eased=p*p*(3-2*p);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY+(endY-startY)*eased}]});await page.waitForTimeout(25);}
            await page.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>undefined);await cdp.detach();}
          let previousScroll=null,scrollMatches=0;
          await expect.poll(async()=>{const s=await state('touch scroll settling');scrollMatches=s.contentScrollTop===previousScroll?scrollMatches+1:0;previousScroll=s.contentScrollTop;return scrollMatches;},{timeout:2000,intervals:[50,75]}).toBeGreaterThanOrEqual(3);
          gesture.after=await state('after trusted touch scroll');
          expect(Math.abs(gesture.after.contentScrollTop-before.contentScrollTop),'Trusted swipe changes the actual panel scroll offset').toBeGreaterThan(1);
        }
        expect(exposed(await state('required controls after optional scroll'))).toBe(true);
      });
      o.afterScroll=await state('after optional trusted touch scroll');await page.waitForTimeout(1900);o.after1900ms=await state('1900ms after optional scroll');
      o.trace=await page.evaluate(()=>window.__utilitySurface.stop());
      o.preferencesAfter=preferences();o.downloadCallsAfter=await downloadActions(page);o.canonicalAfter=await actual(page);
      await capture(page,result,testInfo,'booky-utility-landscape-'+action+'-'+language+'-'+view.width+'.png');
      await checked('trusted optional scroll events',()=>{if(o.touchScroll.gestures.length){for(const type of ['touchstart','touchmove'])expect(o.trace.events.some(e=>e.type===type&&e.trusted&&e.insideContent&&e.at>=o.settled.at)).toBe(true);}});
      await checked('explicit trusted touch action',()=>{for(const type of ['pointerdown','click'])expect(o.trace.events.some(e=>e.type===type&&e.action===action&&e.trusted&&e.pointerType==='touch')).toBe(true);expect(o.trace.events.filter(e=>e.type==='click'&&e.insideTarget)).toEqual([]);});
      await checked('graphics closed and whole companion in measured dock',()=>{
        const s=o.after1900ms;expect(o.before.graphicsOpen).toBe(false);expect(s.graphicsOpen).toBe(false);expect(s.dockActive).toBe(true);
        expect(s.pet.width).toBe(240);expect(s.pet.height).toBe(96);expect(s.dock.height).toBe(120);
        expect(s.pet.left>=s.dock.left-.1&&s.pet.top>=s.dock.top-.1&&s.pet.right<=s.dock.right+.1&&s.pet.bottom<=s.dock.bottom+.1).toBe(true);
        expect(s.content.bottom).toBeLessThanOrEqual(s.dock.top+.1);
      });
      await checked('finite approach point return and continuous handoff',()=>{
        const phases={};for(const name of ['approaching','tapping','returning'])phases[name]=o.trace.samples.filter(s=>name==='returning'?s.returning:s.phase===name);
        o.phaseMetrics=Object.fromEntries(Object.entries(phases).map(([name,samples])=>[name,{frames:samples.length,first:samples[0]??null,last:samples.at(-1)??null}]));
        const drawOwners=[...new Set(o.trace.draws.map(d=>d.owner))];expect(drawOwners).toHaveLength(2);o.motionProvenance={};
        for(const name of ['approaching','returning']){
          const samples=phases[name];expect(samples.length).toBeGreaterThan(2);
          expect(Math.hypot(samples.at(-1).pet.left-samples[0].pet.left,samples.at(-1).pet.top-samples[0].pet.top)).toBeGreaterThan(8);
          const owner=drawOwners[name==='approaching'?0:1],authored=o.trace.draws.filter(d=>d.owner===owner),first=authored[0];
          expect(first.duration).toBe(1600);expect(authored.every(d=>d.duration===first.duration&&d.began===first.began&&JSON.stringify(d.path)===JSON.stringify(first.path))).toBe(true);
          const candidates=[{...first,time:first.began,progress:0,point:first.path.from,recordedAt:first.began,initial:true},...authored];
          let priorTime=first.began;const matched=[];
          for(const [index,s] of samples.entries()){
            const choices=candidates.filter(d=>d.time>=priorTime&&d.recordedAt<=s.readEnd+.001&&Math.abs(d.point.left-s.pet.left)<=1/32&&Math.abs(d.point.top-s.pet.top)<=1/32)
              .sort((a,b)=>Math.hypot(a.point.left-s.pet.left,a.point.top-s.pet.top)-Math.hypot(b.point.left-s.pet.left,b.point.top-s.pet.top)||a.time-b.time);
            expect(choices.length,'Every moving DOM sample matches current owner/path draw, including initial path.from').toBeGreaterThan(0);
            const d=choices[0];priorTime=d.time;matched.push({index,owner,sourceTime:d.time,sourceProgress:d.progress,sourcePoint:d.point,initial:d.initial===true,observerRafAt:s.rafAt,readStart:s.readStart,readEnd:s.readEnd,pet:s.pet});
          }
          const observerIntervals=[];
          for(let i=1;i<matched.length;i++){
            const a=matched[i-1],b=matched[i],px=Math.hypot(b.pet.left-a.pet.left,b.pet.top-a.pet.top),sourceDt=b.sourceTime-a.sourceTime;
            expect(sourceDt).toBeGreaterThanOrEqual(0);expect(px).toBeLessThanOrEqual(Math.hypot(view.width,view.height)*1.5/1600*sourceDt+3);
            const rafDt=b.observerRafAt-a.observerRafAt,readDt=b.readEnd-a.readEnd,bound=Math.hypot(view.width,view.height)*1.5/1600*rafDt+3;
            observerIntervals.push({index:i,px,sourceDt,rafDt,readDt,observerBound:bound,observerBoundExceeded:px>bound});
          }
          o.motionProvenance[name]={owner,path:first.path,began:first.began,duration:first.duration,roundingTolerance:1/32,matched,observerIntervals,
            maxReadCostMs:Math.max(...samples.map(s=>s.readEnd-s.readStart)),observerIntervalViolations:observerIntervals.filter(s=>s.observerBoundExceeded)};
        }
        expect(phases.tapping.length).toBeGreaterThan(0);
        expect(phases.approaching.at(-1).at).toBeLessThan(phases.tapping[0].at);expect(phases.tapping.at(-1).at).toBeLessThan(phases.returning[0].at);
        expect(phases.returning.at(-1).at-phases.approaching[0].at).toBeLessThan(5500);
        for(const s of phases.returning){expect(s.phase).toBeNull();expect(s.gesture).toBe('walking');}
        const a=phases.tapping.at(-1),b=phases.returning[0],c=phases.returning.at(-1);
        expect(Math.hypot(b.pet.left-a.pet.left,b.pet.top-a.pet.top)).toBeLessThan(5);
        expect(Math.hypot(o.settled.pet.left-c.pet.left,o.settled.pet.top-c.pet.top)).toBeLessThan(5);
      });
      await checked('visible body prose clear after natural return',()=>{
        const s=o.after1900ms,visible=s.prose.filter(item=>item.visible);expect(visible.length).toBeGreaterThan(0);
        const overlaps=r=>Math.min(r.right,s.pet.right)>Math.max(r.left,s.pet.left)+.1&&Math.min(r.bottom,s.pet.bottom)>Math.max(r.top,s.pet.top)+.1;
        o.obstructedProse=visible.filter(item=>overlaps(item.visible));expect(o.obstructedProse).toEqual([]);
      });
      await checked('whole pet stays in viewport',()=>{expect(fits(o.after1900ms.pet,o.after1900ms.viewport)).toBe(true);expect(o.trace.samples.filter(s=>s.pet).every(s=>fits(s.pet,s.viewport))).toBe(true);});
      await checked('1900ms exact stillness and no automatic resume',()=>{expect(o.after1900ms.at-o.afterScroll.at).toBeGreaterThanOrEqual(1900);expect(o.after1900ms.pet).toEqual(o.settled.pet);for(const s of o.trace.samples.filter(s=>s.at>=o.settled.at)){expect(s.pet).toEqual(o.settled.pet);expect(s.phase).toBeNull();expect(s.returning).toBe(false);expect(s.gesture).not.toBe('walking');}});
      await checked('required section controls are actually visible',()=>{const visible=o.after1900ms.controls.filter(c=>c.visibility!=='none');if(action==='recent')expect(visible.some(c=>c.recentEntry)).toBe(true);else{expect(visible.some(c=>c.tag==='INPUT'&&c.inputType==='checkbox')).toBe(true);expect(visible.some(c=>c.tag==='LABEL')).toBe(true);}});
      await checked('visible section and header hit points',()=>{const visible=o.after1900ms.controls.filter(c=>c.visibility!=='none');expect(visible.length).toBeGreaterThan(0);expect(visible.filter(c=>!c.reachable)).toEqual([]);});
      await checked('preferences and progress bytes unchanged',()=>expect(o.preferencesAfter).toEqual(o.preferencesBefore));
      await checked('no automatic download action',()=>expect(o.downloadCallsAfter).toEqual(o.downloadCallsBefore));
      await checked('canonical scene camera resources unchanged',()=>retained(o.canonicalAfter,o.canonicalBefore));
      await checked('actual App fixture integrity',()=>fixture.verify());
      result.pass=o.findings.length===0;result.observationsComplete=true;
      expect(o.findings,'All independent observations are preserved before this summary assertion').toEqual([]);
    }catch(error){
      result.pass=false;o.failure=error.message;
      if(!o.trace)o.trace=await page.evaluate(()=>window.__utilitySurface?.stop()??null).catch(()=>null);
      if(!result.screenshots.length)await capture(page,result,testInfo,'booky-utility-landscape-'+action+'-'+language+'-'+view.width+'.png').catch(()=>undefined);
      throw error;
    }finally{await fixture.close();}
  });
}

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:844,height:390}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky touch drag capture and viewport lifecycle '+language,async({},testInfo)=>{
  const fixture=await open(testInfo),{page,result}=fixture,o=result.observations.dragLifecycle={language,portrait,landscape,checks:[],findings:[],rotations:[]};result.scenario='touch-drag-lifecycle-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message});o.findings.push(name);}};
  const state=label=>page.evaluate(label=>window.__dragLifecycle.read(label),label),phase=label=>page.evaluate(label=>window.__dragLifecycle.phase=label,label);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const saved=()=>({memory:[...fixture.memory],writes:fixture.operations.filter(v=>v.operation!=='get')});
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await live(page);await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(true);
    await page.locator('[data-planet-mascot-collapse]').tap();await expect(panel(page)).toHaveCount(0);await twoFrames(page);await live(page);
    o.preferencesBefore=saved();o.canonicalBefore=await actual(page);
    await page.evaluate(()=>{
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const v=window.__dragLifecycle={events:[],samples:[],captureOwners:new Map(),phase:'setup',frame:0,stopped:false};
      v.read=label=>{const p=document.querySelector('[data-planet-mascot-pet]');return{label,at:performance.now(),phase:v.phase,viewport:{width:innerWidth,height:innerHeight},pet:rect(p),gesture:p?.getAttribute('data-planet-mascot-gesture'),open:p?.getAttribute('data-planet-mascot-panel-state')};};
      const event=e=>{const t=e.target instanceof Element?e.target:null;if(e.type==='gotpointercapture'&&t)v.captureOwners.set(e.pointerId,t);v.events.push({ownerTag:t?.tagName,ownerCaptured:t?.hasPointerCapture?.(e.pointerId),at:performance.now(),phase:v.phase,type:e.type,id:e.pointerId,primary:e.isPrimary,trusted:e.isTrusted,pointerType:e.pointerType,x:e.clientX,y:e.clientY,target:t?.closest('[data-planet-mascot-move]')?'handle':t?.closest('[data-planet-mascot-toggle]')?'avatar':'other'});};
      const types=['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','click'];for(const type of types)document.addEventListener(type,event,true);
      const frame=()=>{if(v.stopped)return;v.samples.push(v.read('frame'));v.frame=requestAnimationFrame(frame);};v.frame=requestAnimationFrame(frame);
      v.stop=()=>{v.stopped=true;cancelAnimationFrame(v.frame);for(const type of types)document.removeEventListener(type,event,true);return{events:v.events,samples:v.samples};};
    });
    cdp=await page.context().newCDPSession(page);
    const start=async(source,label,move=true)=>{
      await phase(label);const before=await state('before pointerdown'),r=await page.locator(source==='avatar'?'[data-planet-mascot-toggle]':'[data-planet-mascot-move]').boundingBox();
      let p={x:r.x+r.width/2,y:r.y+r.height/2,id:11};await touch('touchStart',[p]);
      if(move){p={...p,x:p.x+(before.pet.left<before.viewport.width/2?20:-20),y:p.y+(before.pet.top<before.viewport.height/2?12:-12)};await touch('touchMove',[p]);}
      await twoFrames(page);return{source,moved:move,before,active:await state('after primary start'),pointer:p};
    };
    await checked('secondary controlled capture loss retains primary owner',async()=>{
      const r=o.secondaryCapture={trigger:'controlled releasePointerCapture for secondary touch, followed by trusted CDP touchMove; not a natural second-finger lift',...await start('avatar','secondary-primary')};
      try{
        const h=await page.locator('[data-planet-mascot-move]').boundingBox();let second={x:h.x+h.width/2,y:h.y+h.height/2,id:22};
        await phase('secondary-down');await touch('touchStart',[r.pointer,second]);second={...second,x:second.x+1};await touch('touchMove',[r.pointer,second]);await twoFrames(page);
        r.beforeRelease=await state('secondary captured');r.secondaryId=await page.evaluate(()=>window.__dragLifecycle.events.findLast(e=>e.phase==='secondary-down'&&e.type==='pointerdown'&&!e.primary)?.id);
        r.captureOwner=await page.evaluate(id=>{const owner=window.__dragLifecycle.captureOwners.get(id),handle=document.querySelector('[data-planet-mascot-move]');return{tag:owner?.tagName,insideHandle:!!owner&&handle.contains(owner),captured:!!owner?.hasPointerCapture(id)};},r.secondaryId);expect(r.captureOwner.insideHandle).toBe(true);expect(r.captureOwner.captured).toBe(true);
        await phase('secondary-controlled-release');await page.evaluate(id=>window.__dragLifecycle.captureOwners.get(id).releasePointerCapture(id),r.secondaryId);
        second={...second,x:second.x+1};await touch('touchMove',[r.pointer,second]);await twoFrames(page);r.afterRelease=await state('secondary lost capture');
        await phase('secondary-primary-continues');r.pointer={...r.pointer,x:r.pointer.x-12,y:r.pointer.y-8};await touch('touchMove',[r.pointer,second]);await twoFrames(page);r.afterContinued=await state('primary still held after secondary lost capture');
        r.nativeLost=await page.evaluate(id=>window.__dragLifecycle.events.filter(e=>e.phase==='secondary-controlled-release'&&e.type==='lostpointercapture'&&e.id===id),r.secondaryId);
        expect(r.nativeLost.some(e=>e.trusted&&e.target==='handle'&&!e.primary)).toBe(true);expect(r.afterRelease.gesture).toBe('dragging');expect(Math.hypot(r.afterContinued.pet.left-r.afterRelease.pet.left,r.afterContinued.pet.top-r.afterRelease.pet.top)).toBeGreaterThan(5);
      }finally{await phase('secondary-cleanup');await touch('touchCancel',[]);await twoFrames(page);}
    });
    for(const [source,moved,next]of[['handle',true,landscape],['avatar',true,portrait],['avatar',false,landscape]])await checked(source+(moved?' drag':' pending tap')+' retires on rotation',async()=>{
      const r={...await start(source,source+(moved?'-drag':'-tap'),moved),next};o.rotations.push(r);
      try{
        if(moved)expect(r.active.gesture).toBe('dragging');else{r.preResizeEvents=await page.evaluate(label=>window.__dragLifecycle.events.filter(e=>e.phase===label),source+'-tap');expect(r.moved).toBe(false);expect(r.preResizeEvents.filter(e=>e.type==='pointerdown'&&e.primary&&e.trusted)).toHaveLength(1);expect(r.preResizeEvents.filter(e=>e.type==='pointermove')).toHaveLength(0);expect(r.active.pet).toEqual(r.before.pet);}
        await phase(source+'-resize');await page.setViewportSize(next);await twoFrames(page);r.afterResize=await state('after viewport change');
        const a=await page.locator('[data-planet-mascot-toggle]').boundingBox();r.pointer={...r.pointer,x:a.x+a.width/2,y:a.y+a.height/2};
        await phase(source+'-continued-pointer');await touch('touchMove',[r.pointer]);await twoFrames(page);r.afterContinued=await state('original pointer continued');
        await touch('touchEnd',[]);await twoFrames(page);r.afterRelease=await state('original pointer released');
        expect(r.afterResize.gesture).not.toBe('dragging');expect(r.afterContinued.pet).toEqual(r.afterResize.pet);expect(r.afterRelease.open).toBe('closed');expect(r.afterRelease.gesture).not.toBe('dragging');
        expect(r.afterRelease.pet.left>=-.1&&r.afterRelease.pet.top>=-.1&&r.afterRelease.pet.right<=next.width+.1&&r.afterRelease.pet.bottom<=next.height+.1).toBe(true);
      }finally{await touch('touchCancel',[]).catch(()=>undefined);await twoFrames(page);}
      const fresh=r.fresh=await start('handle',source+'-fresh-drag');await touch('touchEnd',[]);await twoFrames(page);fresh.released=await state('fresh drag released');
      expect(fresh.active.gesture).toBe('dragging');expect(Math.hypot(fresh.active.pet.left-fresh.before.pet.left,fresh.active.pet.top-fresh.before.pet.top)).toBeGreaterThan(5);expect(fresh.released.open).toBe('closed');
    });
    o.settled=await state('finished all explicit touches');await page.waitForTimeout(1900);o.after1900ms=await state('after 1900ms');o.trace=await page.evaluate(()=>window.__dragLifecycle.stop());
    await capture(page,result,testInfo,'booky-drag-lifecycle-'+language+'-'+landscape.width+'.png');o.preferencesAfter=saved();o.canonicalAfter=await actual(page);
    await checked('trusted touch provenance and stillness',()=>{expect(o.trace.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.pointerType==='touch'&&e.target==='avatar')).toBe(true);expect(o.trace.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.pointerType==='touch'&&e.target==='handle')).toBe(true);expect(o.after1900ms.at-o.settled.at).toBeGreaterThanOrEqual(1900);expect(o.after1900ms.pet).toEqual(o.settled.pet);expect(o.after1900ms.open).toBe('closed');expect(o.after1900ms.gesture).not.toBe('dragging');});
    await checked('preferences and canonical scene unchanged',()=>{expect(o.preferencesAfter).toEqual(o.preferencesBefore);retained(o.canonicalAfter,o.canonicalBefore,false);});
    await checked('actual App integrity',()=>fixture.verify());result.pass=o.findings.length===0;result.observationsComplete=true;
    if(result.pass)Object.assign(result,{touchDragRetiredOnViewportChange:true,pendingAvatarTapRetiredOnViewportChange:true,secondaryCaptureLossRetainsPrimaryDrag:true,freshTouchDragAfterViewportChange:true,dragLifecyclePreservesPreferencesAndScene:true,noAutomaticDragResume:true});
    expect(o.findings).toEqual([]);
  }finally{
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>undefined);await cdp.detach();}
    if(!o.trace)o.trace=await page.evaluate(()=>window.__dragLifecycle?.stop()??null).catch(()=>null);await fixture.close();
  }
});

for(const [language,portrait,landscape] of [['ru',{width:390,height:844},{width:844,height:390}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky mobile touch gesture gallery '+language,async({},testInfo)=>{
  test.setTimeout(180000);const fixture=await open(testInfo),{page,result}=fixture,o=result.observations.touchGestures={language,portrait,landscape,checks:[],findings:[],orientations:[]};result.scenario='mobile-touch-gestures-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory],writes:fixture.operations.filter(v=>v.operation!=='get')});
  const gestures=['greeting','nod','curious','happy','reassuring','wink','sway','dance','hop','twirl','stretch','shy','highfive','bow','balance'];
  const phase=value=>page.evaluate(value=>window.__touchGestures.phase=value,value);
  const read=selector=>page.evaluate(selector=>window.__touchGestures.read(selector),selector);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(true);await live(page);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');o.preferencesBefore=saved();o.canonicalBefore=await actual(page);
    await page.evaluate(()=>{
      const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const v=window.__touchGestures={phase:'setup',events:[],swipes:[]};
      v.read=selector=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,rect=box(target),r=box(card),h=box(heading),p=document.querySelector('[data-planet-mascot-pet]');
        const clip=r?{left:Math.max(0,r.left+2),right:Math.min(innerWidth,r.right-2),top:Math.max(0,r.top+2,h?.bottom??0),bottom:Math.min(innerHeight,r.bottom-2)}:null;
        const inside=!!rect&&!!clip&&rect.width>0&&rect.height>0&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5;
        const hits=rect?[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+5,y:rect.top+5},{x:rect.right-5,y:rect.bottom-5}].map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),tag:hit?.tagName,text:hit?.textContent?.slice(0,80)}}):[];
        return{at:performance.now(),phase:v.phase,viewport:{width:innerWidth,height:innerHeight},card:r,heading:h,clip,scrollTop:card?.scrollTop,scrollHeight:card?.scrollHeight,clientHeight:card?.clientHeight,pet:box(p),gesture:p?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),target:rect,inside,hits,text:target?.textContent,fontSize:target?parseFloat(getComputedStyle(target).fontSize):null,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1};};
      const observe=e=>{const t=e.target instanceof Element?e.target:null,button=t?.closest('[data-booky-gesture],[data-booky-surprise]');v.events.push({at:performance.now(),phase:v.phase,type:e.type,trusted:e.isTrusted,pointerType:e.pointerType,id:e.pointerId,gesture:button?.getAttribute('data-booky-gesture'),surprise:button?.hasAttribute('data-booky-surprise')??false,insidePanel:!!t?.closest('[data-planet-mascot-panel]')});};
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','touchstart','touchmove'])document.addEventListener(type,observe,{capture:true,passive:true});
    });
    cdp=await page.context().newCDPSession(page);
    async function expose(selector,companion=null){
      for(let attempt=0;attempt<16;attempt++){
        const before=await read(selector),adjacent=companion?await read(companion):null;
        if(before.inside&&before.hits.every(p=>p.hit)&&(!adjacent||(adjacent.inside&&adjacent.hits.every(p=>p.hit))))return before;
        if(!before.target||!before.clip||before.target.height===0)throw Error('Target has no displayed geometry '+selector);
        if(adjacent&&!adjacent.target)throw Error('Adjacent target has no displayed geometry '+companion);
        const extent=adjacent?{top:Math.min(before.target.top,adjacent.target.top),bottom:Math.max(before.target.bottom,adjacent.target.bottom)}:before.target;
        const down=extent.bottom>before.clip.bottom,space=before.clip.bottom-before.clip.top;
        if(adjacent&&extent.bottom-extent.top>space)throw Error('Adjacent gesture buttons do not fit the touch clip');
        if(space<48)throw Error('Panel usable height below touch gesture '+space);
        const distance=adjacent?Math.min(space-24,Math.max(48,down?extent.bottom-before.clip.bottom+6:before.clip.top-extent.top+6)):space-24;
        const x=(before.clip.left+before.clip.right)/2,startY=down?before.clip.bottom-12:before.clip.top+12,endY=startY+(down?-distance:distance);
        const stamp=await page.evaluate(()=>({eventCount:window.__touchGestures.events.length,frames:window.__bookyLiveFixture.booky().renderedFrames}));
        await phase('scroll '+selector);await touch('touchStart',[{x,y:startY,id:31}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:startY+(endY-startY)*step/8,id:31}]);await page.waitForTimeout(24);}if(adjacent)await page.waitForTimeout(180);await touch('touchEnd',[]);
        let previous=-1,matches=0;await expect.poll(async()=>{const at=(await read()).scrollTop;matches=Math.abs(at-previous)<.1?matches+1:0;previous=at;return matches;},{timeout:2500,intervals:[50]}).toBeGreaterThanOrEqual(3);
        const after=await read(selector),events=await page.evaluate(from=>window.__touchGestures.events.slice(from),stamp.eventCount),entry={selector,adjacent,before,after,events,drag:{x,startY,endY,distance}};o.swipes??=[];o.swipes.push(entry);
        if(adjacent)expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch'),'Paired alignment crosses native touch scroll threshold').toBe(true);expect(Math.abs(after.scrollTop-before.scrollTop),'Trusted swipe changes actual panel offset').toBeGreaterThan(1);expect(events.filter(e=>e.type==='click'&&(e.gesture||e.surprise))).toEqual([]);expect(after.gesture).toBe(before.gesture);expect(after.animating).toBe('false');
      }
      throw Error('Could not reveal target through bounded trusted swipes '+selector);
    }
    async function tap(selector,label){const state=await expose(selector);expect(state.hits.every(p=>p.hit)).toBe(true);await phase(label);const x=(state.target.left+state.target.right)/2,y=(state.target.top+state.target.bottom)/2;await touch('touchStart',[{x,y,id:41}]);await touch('touchEnd',[]);await twoFrames(page);return state;}
    async function activate(selector,expected,label,reduced=false){
      await expose(selector);const prior=await read(),eventStart=await page.evaluate(()=>window.__touchGestures.events.length);await page.evaluate(()=>window.__bookyLiveFixture.markGesture());const target=await tap(selector,label);const interaction=await pet(page).getAttribute('data-planet-mascot-gesture');
      if(expected)expect(interaction).toBe(expected);else{expect(gestures).toContain(interaction);expect(interaction).not.toBe(prior.gesture);}
      const events=await page.evaluate(from=>window.__touchGestures.events.slice(from),eventStart);
      for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&(expected?event.gesture===expected:event.surprise))).toBe(true);
      const entry={label,expected,interaction,previous:prior.gesture,previousAnimating:prior.animating,target,reduced,events};
      if(reduced){await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);const first=await character(page);await twoFrames(page);const next=await character(page);expect(next.renderedFrames).toBe(first.renderedFrames);expect(next.rig).toEqual(first.rig);entry.frames=first.renderedFrames;entry.pose=first.rig;}
      else{await expect.poll(()=>page.evaluate(()=>{const t=window.__bookyLiveFixture.gestureTrace();return t.frames-t.start.frames}),{timeout:1800}).toBeGreaterThan(2);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false',{timeout:4000});entry.trace=await page.evaluate(()=>window.__bookyLiveFixture.gestureTrace());expect(new Set(entry.trace.timeline.map(x=>JSON.stringify(x.pose))).size).toBeGreaterThan(1);const timeline=entry.trace.timeline,first=timeline[0].at,last=timeline.at(-1).at,duration=await page.evaluate(value=>window.__bookyLiveFixture.reactionDuration(value),interaction),gap=Math.max(0,...timeline.slice(1).map((v,i)=>v.at-timeline[i].at));entry.duration=duration;entry.maxObservedFrameGap=gap;expect(last-first).toBeLessThanOrEqual(duration+Math.max(100,gap));expect(last-entry.trace.start.at).toBeLessThan(5000);const frames=(await character(page)).renderedFrames;await twoFrames(page);expect((await character(page)).renderedFrames).toBe(frames);}
      expect(saved()).toEqual(o.preferencesBefore);return entry;
    }
    const summary='[data-booky-gestures] > summary';await tap(summary,'open gesture gallery');await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expect(page.locator('[data-booky-gesture]')).toHaveCount(15);
    for(const [orientation,viewport]of[['portrait',portrait],['landscape',landscape]]){
      const mode={orientation,viewport,actions:[],checks:[]};o.orientations.push(mode);
      if(orientation==='landscape'){await page.setViewportSize(viewport);await twoFrames(page);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');}
      await checked(orientation+' help placement',async()=>{await live(page);const s=await read();mode.layout=s;expect(fits(s.card,s.viewport)).toBe(true);expect(s.bodyOverflow).toBe(false);const close=await page.locator('[data-planet-mascot-collapse]').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,hit:hit===el||el.contains(hit)}});expect(close.hit).toBe(true);expect(close.width).toBeGreaterThanOrEqual(44);expect(close.height).toBeGreaterThanOrEqual(44);});
      await checked(orientation+' gallery readable prose',async()=>{const r=await expose('[data-booky-gestures] > p:first-of-type');mode.prose=r;expect(r.fontSize).toBeGreaterThanOrEqual(14);expect(r.inside).toBe(true);});
      for(const gesture of [...gestures,'highfive',...(orientation==='portrait'?['bow','bow','balance','balance']:[]),...Array(orientation==='portrait'?16:2).fill(null)])await checked(orientation+' '+(gesture??'surprise')+' '+mode.actions.length,async()=>{const selector=gesture?'[data-booky-gesture="'+gesture+'"]':'[data-booky-surprise]';mode.actions.push(await activate(selector,gesture,orientation+' '+(gesture??'surprise')));});
      if(orientation==='portrait'){
        await checked('fresh surprise cycle covers all15 and boundary differs',()=>{const draws=mode.actions.filter(action=>action.expected===null).map(action=>action.interaction);expect(draws).toHaveLength(16);expect([...new Set(draws.slice(0,15))].sort()).toEqual([...gestures].sort());expect(draws[15]).not.toBe(draws[14]);mode.surpriseCycle={first15:draws.slice(0,15),next:draws[15]};});
        await checked('new gestures repeat through trusted touch',()=>{for(const gesture of ['bow','balance'])expect(mode.actions.some(action=>action.expected===gesture&&action.previous===gesture&&action.trace.timeline.length>2)).toBe(true);});
        await checked('trusted touch balance interrupts active bow',async()=>{
          const bow='[data-booky-gesture="bow"]',balance='[data-booky-gesture="balance"]';
          await expose(balance,bow);await page.evaluate(()=>window.__bookyLiveFixture.markGesture());await tap(bow,'interrupt bow');
          expect(await pet(page).getAttribute('data-planet-mascot-gesture')).toBe('bow');expect(await page.locator('[data-booky-canvas]').getAttribute('data-booky-animating')).toBe('true');
          const bowTrace=await page.evaluate(()=>window.__bookyLiveFixture.gestureTrace()),bowDuration=await page.evaluate(()=>window.__bookyLiveFixture.reactionDuration('bow'));
          const replacement=await activate(balance,'balance','interrupt with balance');expect(replacement.previous).toBe('bow');expect(replacement.previousAnimating).toBe('true');
          expect(replacement.trace.start.at-bowTrace.start.at).toBeLessThan(bowDuration);
          expect(replacement.trace.timeline.at(-1).at).toBeGreaterThan(bowTrace.start.at+bowDuration);
          const settled=await character(page);await page.waitForTimeout(100);const still=await character(page);expect(still.renderedFrames).toBe(settled.renderedFrames);expect(still.rig).toEqual(settled.rig);expect(await pet(page).getAttribute('data-planet-mascot-gesture')).toBe('balance');
          mode.interruption={bowTrace,bowDuration,replacement,settledFrames:settled.renderedFrames,stillFrames:still.renderedFrames};
        });
      }
      await checked(orientation+' response readable',async()=>{mode.response=await expose('[data-booky-gesture-response]');expect(mode.response.inside).toBe(true);expect(mode.response.fontSize).toBeGreaterThanOrEqual(14);});
      await capture(page,result,testInfo,'booky-touch-gestures-'+language+'-'+viewport.width+'.png');
    }
    await checked('reduced motion touch',async()=>{await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');o.reduced=[];for(const gesture of ['highfive','bow','balance'])o.reduced.push(await activate('[data-booky-gesture="'+gesture+'"]',gesture,'reduced '+gesture,true));
      expect(o.reduced.find(action=>action.interaction==='bow').pose).not.toEqual(o.reduced.find(action=>action.interaction==='balance').pose);
      o.reduced.push(await activate('[data-booky-surprise]',null,'reduced surprise',true));});
    await checked('trusted activation and scroll provenance',async()=>{o.events=await page.evaluate(()=>window.__touchGestures.events);expect(o.events.filter(e=>e.type==='click'&&(e.gesture||e.surprise)).every(e=>e.trusted)).toBe(true);expect(o.swipes.length).toBeGreaterThan(0);expect(o.events.some(e=>e.type==='pointercancel'&&e.trusted&&e.insidePanel)).toBe(true);});
    await checked('prefs and canonical scene retained',async()=>{o.preferencesAfter=saved();expect(o.preferencesAfter).toEqual(o.preferencesBefore);retained(await actual(page),o.canonicalBefore,false);});
    await checked('close remains reachable by touch',async()=>{const button=page.locator('[data-planet-mascot-collapse]'),r=await button.boundingBox();await phase('close help');await touch('touchStart',[{x:r.x+r.width/2,y:r.y+r.height/2,id:51}]);await touch('touchEnd',[]);await expect(panel(page)).toHaveCount(0);await live(page);});
    await checked('actual App integrity',()=>fixture.verify());result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{mobileFifteenGesturesReachableByTouch:true,mobileGestureScrollingDoesNotPlay:true,mobileGesturesFiniteAndRepeatable:true,mobileSurpriseCycleCoversFifteen:true,mobileSurpriseCycleBoundaryDifferent:true,mobileGestureReducedMotionStatic:true,mobileGestureHelpReadableAfterRotation:true,mobileGesturePreferencesAndSceneRetained:true,mobileGestureTrustedTouch:true,mobileNewGesturesRepeatByTouch:true,mobileBowToBalanceInterrupts:true,mobileNewGesturesReducedMotionStatic:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__touchGestures?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:844,height:390}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky scale label clearance '+language,async({},testInfo)=>{
  const fixture=await open(testInfo),{page,result}=fixture,o=result.observations.scaleClearance={language,portrait,landscape,states:[],checks:[],findings:[]};result.scenario='scale-label-clearance-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory],writes:fixture.operations.filter(v=>v.operation!=='get')});
  try{
    await page.setViewportSize(portrait);await ready(page);if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.evaluate(()=>{window.__scaleTouch={phase:'setup',events:[]};for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{const t=e.target instanceof Element?e.target:null,c=t?.closest('[data-globe-control],[data-planet-mascot-toggle],[data-planet-mascot-collapse]');window.__scaleTouch.events.push({type,at:performance.now(),phase:window.__scaleTouch.phase,trusted:e.isTrusted,pointerType:e.pointerType,control:c?.getAttribute('data-globe-control'),toggle:!!c?.hasAttribute('data-planet-mascot-toggle'),collapse:!!c?.hasAttribute('data-planet-mascot-collapse')});},true);});
    cdp=await page.context().newCDPSession(page);
    const tap=async(selector,phase)=>{const p=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,hit:hit===el||el.contains(hit)}});expect(p.hit,'Trusted tap hits '+selector).toBe(true);await page.evaluate(v=>window.__scaleTouch.phase=v,phase);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:11}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await twoFrames(page);};
    await tap('[data-planet-mascot-toggle]','show companion');await expect(panel(page)).toBeVisible();await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(true);await tap('[data-planet-mascot-collapse]','initial close');await expect(panel(page)).toHaveCount(0);await live(page);o.preferencesBefore=saved();
    const read=label=>page.evaluate(label=>{
      const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}},rect=selector=>box(document.querySelector(selector));
      const badge=document.querySelector('.native-planet-app .globe-scale-feedback'),toolbar=document.querySelector('.native-planet-app .globe-controls'),pet=document.querySelector('[data-planet-mascot-pet]'),card=document.querySelector('[data-planet-mascot-panel]'),walk=document.querySelector('[data-booky-walk]');
      const r=box(badge),p=box(pet),c=box(card),w=box(walk),t=box(toolbar),area=(a,b)=>a&&b?Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)):0;
      const style=getComputedStyle(badge),controls=[...document.querySelectorAll('.globe-controls [data-globe-control]')].map(el=>{const b=box(el),x=(b.left+b.right)/2,y=(b.top+b.bottom)/2,hit=document.elementFromPoint(x,y);return{control:el.getAttribute('data-globe-control'),rect:b,centerHit:hit===el||el.contains(hit),occluder:hit?.className,disabled:el.disabled}});
      return{label,at:performance.now(),viewport:{width:innerWidth,height:innerHeight},badge:{rect:r,text:badge.textContent,position:style.position,top:style.top,pointerEvents:style.pointerEvents,visibility:style.visibility,display:style.display,insideToolbar:toolbar.contains(badge),outsideToolbarTop:t.top-r.top},toolbar:t,pet:p,card:c,walk:{rect:w,disabled:walk?.disabled,display:walk?getComputedStyle(walk).display:null},intersections:{petBadge:area(p,r),walkBadge:area(w,r),cardBadge:area(c,r),petToolbar:area(p,t),cardToolbar:area(c,t)},controls,petState:{gesture:pet.getAttribute('data-planet-mascot-gesture'),panel:pet.getAttribute('data-planet-mascot-panel-state')},documentOverflow:document.documentElement.scrollWidth>innerWidth+1};
    },label);
    async function observe(label,filename){let previous='',matches=0;await expect.poll(async()=>{const s=await read(label),key=JSON.stringify([s.badge.rect,s.pet,s.card]);matches=key===previous?matches+1:0;previous=key;return matches;},{intervals:[32,50],timeout:3000}).toBeGreaterThanOrEqual(3);const s=await read(label);o.states.push(s);await checked(label+' whole pet and label fit',()=>{expect(fits(s.pet,s.viewport)).toBe(true);expect(fits(s.badge.rect,s.viewport)).toBe(true);expect(s.documentOverflow).toBe(false);});await checked(label+' scale label clear of companion',()=>expect(s.intersections.petBadge).toBeLessThanOrEqual(.01));if(s.card)await checked(label+' readable help clear of scale label',()=>{expect(s.intersections.cardBadge).toBeLessThanOrEqual(.01);expect(s.card.height).toBeGreaterThanOrEqual(200);});if(s.viewport.width>s.viewport.height)await checked(label+' compact help keeps walk control appropriate',()=>{if(s.card){expect(s.walk.display).toBe('none');expect(s.walk.rect.height).toBe(0);}else{expect(s.walk.display).not.toBe('none');expect(s.walk.rect.height).toBeGreaterThanOrEqual(44);}});if(filename)await capture(page,result,testInfo,filename);return s;}
    o.initial=await observe('portrait closed before explicit zoom');
    for(const direction of ['in','out'])await checked('real touch zoom '+direction,async()=>{const before=(await read()).badge.text;await tap('[data-globe-control="zoom-'+direction+'"]','zoom-'+direction);await expect.poll(async()=>(await read()).badge.text).not.toBe(before);await ready(page);await stablePose(page);await observe('portrait closed after zoom '+direction);});
    o.canonicalAfterIntendedZoom=await actual(page);await capture(page,result,testInfo,'booky-scale-'+language+'-'+portrait.width+'-closed.png');
    await tap('[data-planet-mascot-toggle]','portrait open');await expect(panel(page)).toBeVisible();await live(page);await observe('portrait open','booky-scale-'+language+'-'+portrait.width+'-open.png');
    await page.setViewportSize(landscape);await ready(page);await live(page);await observe('landscape open','booky-scale-'+language+'-'+landscape.width+'-open.png');
    await tap('[data-planet-mascot-collapse]','landscape close');await expect(panel(page)).toHaveCount(0);await live(page);await observe('landscape closed','booky-scale-'+language+'-'+landscape.width+'-closed.png');
    await checked('output geometry extends beyond toolbar parent',()=>{expect(o.states.every(s=>s.badge.insideToolbar&&s.badge.position==='absolute'&&s.badge.outsideToolbarTop>0)).toBe(true);});
    await checked('preferences and canonical resources retained after intended zoom',async()=>{o.preferencesAfter=saved();expect(o.preferencesAfter).toEqual(o.preferencesBefore);retained(await actual(page),o.canonicalAfterIntendedZoom,false);});
    await checked('trusted touch input provenance',async()=>{o.events=await page.evaluate(()=>window.__scaleTouch.events);for(const control of ['zoom-in','zoom-out'])expect(o.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.pointerType==='touch'&&e.control===control)).toBe(true);expect(o.events.filter(e=>e.type==='click').every(e=>e.trusted)).toBe(true);});
    await checked('actual App integrity',()=>fixture.verify());result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{scaleLabelClearsWholeCompanion:true,scaleLabelClearsOpenHelp:true,scaleLabelTracksRealTouchZoom:true,scaleLabelClearAfterRotation:true,scaleLabelKeepsPreferencesAndScene:true,scaleLabelTrustedTouch:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__scaleTouch?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:568,height:320}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky mobile touch gesture Stop preserves context '+language,async({},testInfo)=>{
  test.setTimeout(90000);const fixture=await open(testInfo),{page,result}=fixture;
  const o=result.observations.gestureStop={language,portrait,landscape,checks:[],findings:[],stops:[],swipes:[],headers:[]};result.scenario='mobile-touch-gesture-stop-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message,stack:error.stack??null});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory],writes:mutations(fixture)}),stopSelector='[data-booky-stop-gesture]',closeSelector='[data-planet-mascot-collapse]';
  const overlap=(a,b)=>Boolean(a&&b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom);
  const gestures=['greeting','nod','curious','happy','reassuring','wink','sway','dance','hop','twirl','stretch','shy','highfive','bow','balance'];
  const read=(selector=null,header=false)=>page.evaluate(({selector,header})=>window.__gestureStop.read(selector,header),{selector,header});
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const trace=()=>page.evaluate(()=>{const t=window.__bookyLiveFixture.gestureTrace();return{start:t.start,frames:t.frames,frameCount:t.timeline.length,firstAt:t.timeline[0]?.at,lastAt:t.timeline.at(-1)?.at};});
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    await page.evaluate(()=>{
      const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const state=window.__gestureStop={phase:'setup',events:[]};
      state.read=(selector,header=false)=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,p=document.querySelector('[data-planet-mascot-pet]'),highlight=document.querySelector('[data-planet-mascot-highlight]');
        const r=box(card),h=box(heading),rect=box(target),clip=r?{left:Math.max(0,r.left+2),right:Math.min(innerWidth,r.right-2),top:Math.max(0,r.top+2,header?0:h?.bottom??0),bottom:Math.min(innerHeight,r.bottom-2)}:null;
        const points=rect?[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+4,y:rect.top+4},{x:rect.right-4,y:rect.bottom-4}]:[];
        return{at:performance.now(),viewport:{width:innerWidth,height:innerHeight},card:r,heading:h,clip,target:rect,inside:!!rect&&!!clip&&rect.width>0&&rect.height>0&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5,hits:points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),tag:hit?.tagName};}),scrollTop:card?.scrollTop,gesture:p?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),context:{pet:box(p),mode:p?.getAttribute('data-planet-mascot-mode'),route:p?.getAttribute('data-planet-mascot-current-route'),step:p?.getAttribute('data-planet-mascot-step'),screen:p?.getAttribute('data-planet-mascot-screen'),panel:p?.getAttribute('data-planet-mascot-panel-state'),highlight:highlight?.getAttribute('data-planet-mascot-highlight')??null,highlightRect:box(highlight)},disabled:target?.disabled??false};};
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','touchmove'])document.addEventListener(type,e=>{const t=e.target instanceof Element?e.target:null,control=t?.closest('[data-booky-stop-gesture],[data-planet-mascot-collapse],[data-booky-gesture],[data-booky-surprise],[data-planet-mascot-route],[data-planet-mascot-finish]');state.events.push({at:performance.now(),phase:state.phase,type,trusted:e.isTrusted,pointerType:e.pointerType,stop:!!control?.hasAttribute('data-booky-stop-gesture'),close:!!control?.hasAttribute('data-planet-mascot-collapse'),gesture:control?.getAttribute('data-booky-gesture')??null,surprise:!!control?.hasAttribute('data-booky-surprise'),insidePanel:!!t?.closest('[data-planet-mascot-panel]')});},{capture:true,passive:true});
    });
    cdp=await page.context().newCDPSession(page);
    async function expose(selector){
      for(let attempt=0;attempt<32;attempt++){
        const before=await read(selector);if(before.inside&&before.hits.every(point=>point.hit))return before;
        expect(before.target,'Displayed touch target '+selector).not.toBeNull();expect(before.clip).not.toBeNull();
        const space=before.clip.bottom-before.clip.top;expect(space).toBeGreaterThan(56);expect(before.target.height).toBeLessThanOrEqual(space);
        const upward=before.target.bottom>before.clip.bottom,overflow=upward?before.target.bottom-before.clip.bottom:before.clip.top-before.target.top;
        const distance=Math.min(space-24,Math.max(48,overflow+18)),x=(before.clip.left+before.clip.right)/2,startY=upward?before.clip.bottom-12:before.clip.top+12,endY=startY+(upward?-distance:distance);
        const start=await page.evaluate(selector=>{window.__gestureStop.phase='scroll '+selector;return window.__gestureStop.events.length;},selector);
        await touch('touchStart',[{x,y:startY,id:71}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:startY+(endY-startY)*step/8,id:71}]);await page.waitForTimeout(20);}await page.waitForTimeout(120);await touch('touchEnd',[]);
        let previous=-1,matches=0;await expect.poll(async()=>{const at=(await read()).scrollTop;matches=Math.abs(at-previous)<.1?matches+1:0;previous=at;return matches;},{timeout:2000,intervals:[40]}).toBeGreaterThanOrEqual(2);
        const after=await read(selector),events=await page.evaluate(from=>window.__gestureStop.events.slice(from),start);o.swipes.push({selector,before,after,drag:{x,startY,endY,distance},events});
        expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch')).toBe(true);expect(events.filter(event=>event.type==='click')).toEqual([]);
        expect(Math.abs(after.scrollTop-before.scrollTop)).toBeGreaterThan(1);expect(after.gesture).toBe(before.gesture);expect(after.animating).toBe('false');
      }
      const final=await read(selector);if(final.inside&&final.hits.every(point=>point.hit))return final;
      throw Error('Trusted touch could not expose '+selector);
    }
    async function tap(selector,label,header=false){
      const target=header?await read(selector,true):await expose(selector);expect(target.inside).toBe(true);expect(target.hits.every(point=>point.hit)).toBe(true);expect(target.disabled).toBe(false);if(header){expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);}
      const start=await page.evaluate(label=>{window.__gestureStop.phase=label;return window.__gestureStop.events.length;},label),x=(target.target.left+target.target.right)/2,y=(target.target.top+target.target.bottom)/2;
      await touch('touchStart',[{x,y,id:81}]);await touch('touchEnd',[]);await twoFrames(page);
      const events=await page.evaluate(from=>window.__gestureStop.events.slice(from),start);for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch')).toBe(true);
      return{target,events};
    }
    async function header(label){
      const stop=page.locator(stopSelector),close=page.locator(closeSelector);
      const geometry=await page.evaluate(()=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card.querySelector('header'),title=heading.querySelector('h2'),r=title.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(title);const textRects=[...range.getClientRects()].map(rect=>({left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}));return{text:title.textContent,title:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},textRects,clientWidth:title.clientWidth,scrollWidth:title.scrollWidth,fontSize:parseFloat(getComputedStyle(title).fontSize),singleLine:new Set(textRects.map(rect=>Math.round(rect.top))).size===1};});
      const a=await read(stopSelector,true),b=await read(closeSelector,true),observation={label,stop:a,close:b,...geometry};o.headers.push(observation);await expect(stop).toHaveAccessibleName(language==='ru'?'Остановить жест':'Stop gesture');await expect(stop).toHaveAttribute('title',language==='ru'?'Остановить жест':'Stop gesture');await expect(stop).toContainText(language==='ru'?'Стоп':'Stop');await expect(close).toHaveAccessibleName(language==='ru'?'Свернуть подсказки':'Collapse tips');expect(geometry.text).toBe(language==='ru'?'Книжулик':'Mr. Booky');expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);expect(geometry.singleLine,label+' title remains on one line').toBe(true);expect(geometry.fontSize,label+' readable title font size').toBeGreaterThanOrEqual(18);
      for(const [control,value] of [['Stop',a],['Close',b]]){expect(value.inside,label+' '+control+' fully inside help card').toBe(true);expect(value.hits.every(point=>point.hit),label+' '+control+' three hit points').toBe(true);expect(value.target.width).toBeGreaterThanOrEqual(44);expect(value.target.height).toBeGreaterThanOrEqual(44);}
      expect(overlap(a.target,b.target)).toBe(false);for(const control of [a.target,b.target])expect(overlap(geometry.title,control)).toBe(false);
      for(const rect of geometry.textRects){expect(fits(rect,a.viewport)).toBe(true);expect(rect.left).toBeGreaterThanOrEqual(a.card.left);expect(rect.right).toBeLessThanOrEqual(a.card.right);expect(rect.top).toBeGreaterThanOrEqual(a.card.top);expect(rect.bottom).toBeLessThanOrEqual(a.card.bottom);}
      return observation;
    }
    async function startGesture(gesture,reduced=false){
      const selector=gesture?'[data-booky-gesture="'+gesture+'"]':'[data-booky-surprise]';await expose(selector);await page.evaluate(()=>window.__bookyLiveFixture.markGesture());const activation=await tap(selector,'play '+(gesture??'surprise'));
      const state=await read();if(gesture)expect(state.gesture).toBe(gesture);else expect(gestures).toContain(state.gesture);
      await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating',reduced?'false':'true');await expect(page.locator(stopSelector)).toBeEnabled();
      const observed=await trace();expect(observed.frames).toBeGreaterThan(observed.start.frames);return{gesture:state.gesture,duration:await page.evaluate(value=>window.__bookyLiveFixture.reactionDuration(value),state.gesture),trace:observed,activation};
    }
    async function stopGesture(label,started=null,pastDeadline=false){
      const before=await read(),preferences=saved(),scene=await sample(page);if(!label.startsWith('stop surprise'))await header(label+' before Stop');const activation=await tap(stopSelector,label,true);
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator('[data-booky-gesture][aria-pressed="true"]')).toHaveCount(0);await expect(page.locator(stopSelector)).toBeDisabled();await expect(panel(page)).toBeVisible();
      await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);const settled=await character(page);
      const clicked=activation.events.find(event=>event.type==='click'&&event.stop);expect(clicked).toBeTruthy();
      if(started){expect(clicked.at-started.trace.start.at).toBeLessThan(started.duration);expect(clicked.at).toBeGreaterThan(started.trace.start.at);}
      if(pastDeadline){const now=await page.evaluate(()=>performance.now());await page.waitForTimeout(Math.max(0,started.trace.start.at+started.duration+180-now));}else await twoFrames(page);
      const still=await character(page),after=await read();expect(still.renderedFrames).toBe(settled.renderedFrames);expect(still.rig).toEqual(settled.rig);expect(after.context).toEqual(before.context);expect(saved()).toEqual(preferences);retained(await sample(page),scene);
      const observation={label,started,activation,before,after,preferencesUnchanged:true,sceneRetained:true,settledFrames:settled.renderedFrames,stillFrames:still.renderedFrames,rig:still.rig,observedAt:await page.evaluate(()=>performance.now())};o.stops.push(observation);return observation;
    }
    await header('portrait initial');if(await page.locator(stopSelector).isEnabled())await stopGesture('clear initial greeting');
    const gallery='[data-booky-gestures] > summary';await tap(gallery,'open gestures');await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expect(page.locator('[data-booky-gesture]')).toHaveCount(15);
    await checked('active Dance stops before deadline and remains still',async()=>{const started=await startGesture('dance');expect(started.duration).toBe(2200);const stopped=await stopGesture('stop active dance',started,true);expect(stopped.observedAt-started.trace.start.at).toBeGreaterThan(started.duration);expect(stopped.before.scrollTop).toBeGreaterThan(0);o.dance=stopped;await capture(page,result,testInfo,'booky-gesture-stop-'+language+'-'+portrait.width+'.png');});
    await checked('a new gesture plays after Stop',async()=>{const started=await startGesture('bow');o.restarted=await stopGesture('stop new bow',started);});
    await checked('immediate Stop preserves all fifteen Surprise choices and boundary',async()=>{
      o.surprises=[];for(let index=0;index<16;index++){const started=await startGesture(null),stopped=await stopGesture('stop surprise '+index,started);o.surprises.push({gesture:started.gesture,stoppedAt:stopped.activation.events.find(event=>event.type==='click'&&event.stop).at,startedAt:started.trace.start.at});}
      expect([...new Set(o.surprises.slice(0,15).map(value=>value.gesture))].sort()).toEqual([...gestures].sort());expect(o.surprises[15].gesture).not.toBe(o.surprises[14].gesture);
    });
    await checked('tour Stop preserves route step and pointing context',async()=>{
      await tap('[data-planet-mascot-route="overview"]','start overview');await expect(pet(page)).toHaveAttribute('data-planet-mascot-current-route','overview');await expect(pet(page)).toHaveAttribute('data-planet-mascot-step','0');await expect(page.locator('[data-planet-mascot-highlight="search"]')).toBeVisible();
      await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');if(!await page.locator('[data-booky-gestures]').evaluate(element=>element.open))await tap(gallery,'open tour gestures');await expose('[data-booky-gesture="bow"]');await twoFrames(page);
      const guided=await character(page),tourContext=(await read()).context,tourPreferences=saved();const started=await startGesture('bow'),stopped=await stopGesture('stop tour bow',started);
      expect(stopped.after.context).toEqual(tourContext);expect(stopped.rig).toEqual(guided.rig);expect(saved()).toEqual(tourPreferences);o.tour={context:tourContext,preferencesBefore:tourPreferences,stop:stopped};
      await tap('[data-planet-mascot-finish]','leave overview');await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    });
    await checked('landscape reduced Balance stops to static neutral',async()=>{
      await page.setViewportSize(landscape);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);
      await expect(pet(page)).toHaveAttribute('data-planet-mascot-mode','help');if(await page.locator(stopSelector).isEnabled())await stopGesture('clear before reduced baseline');
      if(!await page.locator('[data-booky-gestures]').evaluate(element=>element.open))await tap(gallery,'open landscape gestures');await expose('[data-booky-gesture="balance"]');await twoFrames(page);const neutral=await character(page);
      const started=await startGesture('balance',true),balanced=await character(page);expect(balanced.rig).not.toEqual(neutral.rig);const stopped=await stopGesture('stop reduced balance');expect(stopped.rig).toEqual(neutral.rig);o.reduced={started,balancedRig:balanced.rig,neutralRig:neutral.rig,stop:stopped};await header('landscape static stopped');await capture(page,result,testInfo,'booky-gesture-stop-'+language+'-'+landscape.width+'.png');
    });
    await checked('trusted Stop and scroll provenance',async()=>{o.events=await page.evaluate(()=>window.__gestureStop.events);expect(o.events.filter(event=>event.type==='click'&&event.stop).length).toBeGreaterThanOrEqual(20);expect(o.events.filter(event=>event.type==='click').every(event=>event.trusted)).toBe(true);expect(o.swipes.length).toBeGreaterThan(0);});
    await checked('actual App integrity',()=>fixture.verify());result.pass=o.findings.length===0;result.observationsComplete=true;
    if(result.pass)Object.assign(result,{headerGestureStopReachable:true,gestureStopHeaderTitleFits:true,touchStopsActiveGesture:true,stoppedGestureStaysStillPastDeadline:true,stopClearsExplicitSelection:true,stoppedGestureCanRestartByTouch:true,stopPreservesSurpriseCycle:true,reducedGestureStopReturnsNeutral:true,tourGestureStopRetainsContext:true,stopPreservesPreferencesPositionAndScene:true,trustedTouchGestureStop:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__gestureStop?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:568,height:320}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky mobile reduced motion notice and media lifecycle '+language,async({},testInfo)=>{
  test.setTimeout(75000);const fixture=await open(testInfo),{page,result}=fixture;
  const o=result.observations.motionNotice={language,portrait,landscape,checks:[],findings:[],stops:[],swipes:[],notices:[],media:[],plays:[]};result.scenario='mobile-reduced-motion-notice-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message,stack:error.stack??null});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory],writes:mutations(fixture)}),stopSelector='[data-booky-stop-gesture]',closeSelector='[data-planet-mascot-collapse]';
  const overlap=(a,b)=>Boolean(a&&b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom);
  const gestures=['greeting','nod','curious','happy','reassuring','wink','sway','dance','hop','twirl','stretch','shy','highfive','bow','balance'];
  const read=(selector=null,header=false)=>page.evaluate(({selector,header})=>window.__motionNotice.read(selector,header),{selector,header});
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const trace=()=>page.evaluate(()=>{const t=window.__bookyLiveFixture.gestureTrace();return{start:t.start,frames:t.frames,frameCount:t.timeline.length,firstAt:t.timeline[0]?.at,lastAt:t.timeline.at(-1)?.at};});
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);
    await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    await page.evaluate(()=>{
      const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const state=window.__motionNotice={phase:'setup',events:[]};
      state.read=(selector,header=false)=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,p=document.querySelector('[data-planet-mascot-pet]'),highlight=document.querySelector('[data-planet-mascot-highlight]');
        const r=box(card),h=box(heading),rect=box(target),clip=r?{left:Math.max(0,r.left+2),right:Math.min(innerWidth,r.right-2),top:Math.max(0,r.top+2,header?0:h?.bottom??0),bottom:Math.min(innerHeight,r.bottom-2)}:null;
        const points=rect?[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+4,y:rect.top+4},{x:rect.right-4,y:rect.bottom-4}]:[];
        return{at:performance.now(),viewport:{width:innerWidth,height:innerHeight},card:r,heading:h,clip,target:rect,inside:!!rect&&!!clip&&rect.width>0&&rect.height>0&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5,hits:points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),tag:hit?.tagName};}),scrollTop:card?.scrollTop,gesture:p?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),context:{pet:box(p),mode:p?.getAttribute('data-planet-mascot-mode'),route:p?.getAttribute('data-planet-mascot-current-route'),step:p?.getAttribute('data-planet-mascot-step'),screen:p?.getAttribute('data-planet-mascot-screen'),panel:p?.getAttribute('data-planet-mascot-panel-state'),highlight:highlight?.getAttribute('data-planet-mascot-highlight')??null,highlightRect:box(highlight)},selected:[...document.querySelectorAll('[data-booky-gesture][aria-pressed="true"]')].map(element=>element.getAttribute('data-booky-gesture')),disabled:target?.disabled??false};};
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','touchmove'])document.addEventListener(type,e=>{const t=e.target instanceof Element?e.target:null,control=t?.closest('[data-booky-stop-gesture],[data-planet-mascot-collapse],[data-booky-gesture],[data-booky-surprise],[data-planet-mascot-route],[data-planet-mascot-finish]');state.events.push({at:performance.now(),phase:state.phase,type,trusted:e.isTrusted,pointerType:e.pointerType,stop:!!control?.hasAttribute('data-booky-stop-gesture'),close:!!control?.hasAttribute('data-planet-mascot-collapse'),gesture:control?.getAttribute('data-booky-gesture')??null,surprise:!!control?.hasAttribute('data-booky-surprise'),insidePanel:!!t?.closest('[data-planet-mascot-panel]')});},{capture:true,passive:true});
    });
    cdp=await page.context().newCDPSession(page);
    async function expose(selector){
      for(let attempt=0;attempt<32;attempt++){
        const before=await read(selector);if(before.inside&&before.hits.every(point=>point.hit))return before;
        expect(before.target,'Displayed touch target '+selector).not.toBeNull();expect(before.clip).not.toBeNull();
        const space=before.clip.bottom-before.clip.top;expect(space).toBeGreaterThan(56);expect(before.target.height).toBeLessThanOrEqual(space);
        const upward=before.target.bottom>before.clip.bottom,overflow=upward?before.target.bottom-before.clip.bottom:before.clip.top-before.target.top;
        const distance=Math.min(space-24,Math.max(32,overflow+18)),x=(before.clip.left+before.clip.right)/2,startY=upward?before.clip.bottom-12:before.clip.top+12,endY=startY+(upward?-distance:distance);
        const start=await page.evaluate(selector=>{window.__motionNotice.phase='scroll '+selector;return window.__motionNotice.events.length;},selector);
        await touch('touchStart',[{x,y:startY,id:71}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:startY+(endY-startY)*step/8,id:71}]);await page.waitForTimeout(20);}await page.waitForTimeout(120);await touch('touchEnd',[]);
        let previous=-1,matches=0;await expect.poll(async()=>{const at=(await read()).scrollTop;matches=Math.abs(at-previous)<.1?matches+1:0;previous=at;return matches;},{timeout:2000,intervals:[40]}).toBeGreaterThanOrEqual(2);
        const after=await read(selector),events=await page.evaluate(from=>window.__motionNotice.events.slice(from),start);o.swipes.push({selector,before,after,drag:{x,startY,endY,distance},events});
        expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch')).toBe(true);expect(events.filter(event=>event.type==='click')).toEqual([]);
        expect(Math.abs(after.scrollTop-before.scrollTop)).toBeGreaterThan(1);expect(after.gesture).toBe(before.gesture);expect(after.animating).toBe('false');
      }
      const final=await read(selector);if(final.inside&&final.hits.every(point=>point.hit))return final;
      throw Error('Trusted touch could not expose '+selector);
    }
    async function tap(selector,label,header=false){
      const target=header?await read(selector,true):await expose(selector);expect(target.inside).toBe(true);expect(target.hits.every(point=>point.hit)).toBe(true);expect(target.disabled).toBe(false);if(header){expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);}
      const start=await page.evaluate(label=>{window.__motionNotice.phase=label;return window.__motionNotice.events.length;},label),x=(target.target.left+target.target.right)/2,y=(target.target.top+target.target.bottom)/2;
      await touch('touchStart',[{x,y,id:81}]);await touch('touchEnd',[]);await twoFrames(page);
      const events=await page.evaluate(from=>window.__motionNotice.events.slice(from),start);for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch')).toBe(true);
      return{target,events};
    }

    const noticeSelector='[data-booky-motion-notice]',noticeCopy=language==='ru'?'Меньше движения: все жесты доступны как неподвижные позы.':'Reduced motion is on. All gestures are available as still poses.';
    async function allEnabled(label){const values=await page.locator('[data-booky-gesture]').evaluateAll(elements=>elements.map(element=>({gesture:element.getAttribute('data-booky-gesture'),disabled:element.disabled,label:element.textContent.trim()})));o.enabled??=[];o.enabled.push({label,values});expect(values.map(v=>v.gesture).sort()).toEqual([...gestures].sort());expect(values.every(v=>!v.disabled&&v.label.length>0)).toBe(true);}
    async function still(label,wait=180){await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);const before=await character(page);await page.waitForTimeout(wait);const after=await character(page);const observation={label,wait,framesBefore:before.renderedFrames,framesAfter:after.renderedFrames,rigBefore:before.rig,rigAfter:after.rig};o.stillness??=[];o.stillness.push(observation);expect(after.renderedFrames).toBe(before.renderedFrames);expect(after.rig).toEqual(before.rig);return after;}
    const layout=()=>page.evaluate(()=>{
      const selectors='.native-planet-panel__header, .native-planet-app .atlas-immersive-chrome .interface-language-control, .native-planet-app .globe-controls, .native-planet-app .globe-scale-feedback, .native-planet-app .atlas-country-sheet-toggle, .native-planet-app .globe-style-switch, .native-planet-app .globe-edition-scroll-cue, .native-planet-app .globe-style-switch-toggle, .native-planet-app .globe-edition-compact-select, .native-planet-app .book-shelf-frame__navigation, .native-planet-app .book-detail-actions, .native-planet-app .archive-book-actions, .native-planet-app .atlas-country-presentation .panel-close, .native-planet-app .book-detail-page-navigation, .native-planet-app [data-planet-stand-toggle]';
      const box=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
      const animations=new Set(),navigation=[...document.querySelectorAll(selectors)].map((element,index)=>{const r=element.getBoundingClientRect(),ancestors=[],bounds={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};let clipAncestors=getComputedStyle(element).position!=='fixed';
        for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node),rect=box(node.getBoundingClientRect());ancestors.push({tag:node.tagName,className:node.className,rect,display:style.display,visibility:style.visibility,opacity:style.opacity,transform:style.transform,translate:style.translate,animationName:style.animationName,animationDuration:style.animationDuration,animationDelay:style.animationDelay});
          if(node!==element&&node!==document.body&&node!==document.documentElement&&clipAncestors){if(/hidden|clip|scroll|auto/.test(style.overflowX)){bounds.left=Math.max(bounds.left,rect.left);bounds.right=Math.min(bounds.right,rect.right);}if(/hidden|clip|scroll|auto/.test(style.overflowY)){bounds.top=Math.max(bounds.top,rect.top);bounds.bottom=Math.min(bounds.bottom,rect.bottom);}}if(style.position==='fixed')clipAncestors=false;
          for(const animation of node.getAnimations()){const timing=animation.effect?.getComputedTiming();if((animation.pending||animation.playState==='running')&&Number.isFinite(timing?.endTime))animations.add(animation);}}
        const visible=!element.closest('[hidden],[inert],[aria-hidden="true"]')&&ancestors[0].visibility==='visible'&&ancestors.every(a=>a.display!=='none'&&Number(a.opacity)!==0)&&bounds.right-bounds.left>=2&&bounds.bottom-bounds.top>=2;
        return{index,tag:element.tagName,className:element.className,rect:box(r),visible,effectiveRect:visible?{...bounds,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top}:null,ancestors};});
      return{state:window.__motionNotice.read(),navigation,runningAnimations:[...animations].map(animation=>({playState:animation.playState,pending:animation.pending,currentTime:animation.currentTime,endTime:animation.effect.getComputedTiming().endTime}))};
    });
    const navigationGeometry=value=>({viewport:value.state.viewport,controls:value.navigation.filter(value=>value.visible).map(value=>value.effectiveRect).sort((a,b)=>a.top-b.top||a.left-b.left||a.bottom-b.bottom||a.right-b.right)});
    async function settleLayout(label,requireStatic=false){
      const observation={label,requireStatic,samples:[]};o.layouts??=[];o.layouts.push(observation);let previous,matches=0,last;
      await expect.poll(async()=>{last=await layout();observation.samples.push(last);const key=JSON.stringify({navigation:navigationGeometry(last),pet:last.state.context.pet,card:last.state.card});matches=key===previous&&!last.runningAnimations.length?matches+1:0;previous=key;return matches;},{timeout:2200,intervals:[80]}).toBeGreaterThanOrEqual(3);
      if(requireStatic)expect(observation.samples.every(value=>value.state.animating==='false'),label+' character stays static throughout layout settling').toBe(true);return last;
    }
    async function setMotion(reduced,label,wait=180,requireActive=false){
      const settledBefore=await settleLayout(label+' before media'),before=await read(),preferences=saved(),scene=await sample(page);if(requireActive)expect(before.animating,label+' active immediately before media input').toBe('true');const mediaRequestedAt=await page.evaluate(()=>performance.now());await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion',String(reduced));const edge={label,reduced,mediaRequestedAt,state:await read()};o.mediaEdges??=[];o.mediaEdges.push(edge);expect(edge.state.animating,label+' first draw after media input is static').toBe('false');await expect(page.locator(noticeSelector)).toHaveText(reduced?noticeCopy:'');
      const settledAfter=await settleLayout(label+' after media',true),pose=await still(label,wait),after=await read(),sameNavigationGeometry=JSON.stringify(navigationGeometry(settledBefore))===JSON.stringify(navigationGeometry(settledAfter));
      const observation={label,reduced,requireActive,mediaRequestedAt,before,after,settledBefore,settledAfter,sameNavigationGeometry,preferencesBefore:preferences,preferencesAfter:saved(),sceneBefore:scene,sceneAfter:await sample(page),frames:pose.renderedFrames,rig:pose.rig};o.media.push(observation);
      const clearance={label,pet:after.context.pet,controls:settledAfter.navigation.filter(value=>value.visible).map(value=>{const r=value.effectiveRect,p=after.context.pet;return{className:value.className,rect:r,overlapArea:Math.max(0,Math.min(p.right,r.right)-Math.max(p.left,r.left))*Math.max(0,Math.min(p.bottom,r.bottom)-Math.max(p.top,r.top))};})};o.clearance??=[];o.clearance.push(clearance);
      expect(clearance.controls.filter(value=>value.overlapArea>0),label+' settled companion clears every actual visible navigation region').toEqual([]);
      const {pet:beforePet,...beforeContext}=before.context,{pet:afterPet,...afterContext}=after.context;expect(afterContext).toEqual(beforeContext);expect(after.gesture).toBe(before.gesture);expect(after.selected).toEqual(before.selected);expect(observation.preferencesAfter).toEqual(preferences);retained(observation.sceneAfter,scene);
      expect(fits(beforePet,before.viewport)).toBe(true);expect(fits(afterPet,after.viewport)).toBe(true);expect(after.viewport).toEqual(before.viewport);expect([afterPet.width,afterPet.height]).toEqual([beforePet.width,beforePet.height]);expect(afterPet).toEqual(settledAfter.state.context.pet);if(sameNavigationGeometry)expect(afterPet,label+' identical settled navigation keeps exact companion bounds').toEqual(beforePet);return observation;
    }
    async function notice(label){
      const target=await expose(noticeSelector),geometry=await page.locator(noticeSelector).evaluate(element=>{const p=element.querySelector('p'),r=p.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(p);const box=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});return{text:element.textContent,role:element.getAttribute('role'),live:element.getAttribute('aria-live'),atomic:element.getAttribute('aria-atomic'),paragraph:box(r),fontSize:parseFloat(getComputedStyle(p).fontSize),textRects:[...range.getClientRects()].map(box)};});
      const observation={label,target,...geometry};o.notices.push(observation);expect(geometry.text).toBe(noticeCopy);expect([geometry.role,geometry.live,geometry.atomic]).toEqual(['status','polite','true']);expect(geometry.fontSize).toBeGreaterThanOrEqual(14);expect(target.inside).toBe(true);expect(target.hits.every(p=>p.hit)).toBe(true);
      for(const rect of geometry.textRects){expect(fits(rect,target.viewport)).toBe(true);expect(rect.left).toBeGreaterThanOrEqual(target.clip.left);expect(rect.right).toBeLessThanOrEqual(target.clip.right);expect(rect.top).toBeGreaterThanOrEqual(target.clip.top);expect(rect.bottom).toBeLessThanOrEqual(target.clip.bottom);}return observation;
    }
    async function play(gesture,reduced,label){const before=await character(page),activation=await tap('[data-booky-gesture="'+gesture+'"]',label);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture',gesture);await expect(page.locator('[data-booky-gesture="'+gesture+'"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating',reduced?'false':'true');const after=await character(page),observation={label,gesture,reduced,activation,framesBefore:before.renderedFrames,framesAfter:after.renderedFrames,rig:after.rig};o.plays.push(observation);expect(after.renderedFrames).toBeGreaterThan(before.renderedFrames);return observation;}
    async function stop(label){const before=await read(),preferences=saved(),scene=await sample(page),activation=await tap(stopSelector,label,true);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator('[data-booky-gesture][aria-pressed="true"]')).toHaveCount(0);await expect(page.locator(stopSelector)).toBeDisabled();const pose=await still(label),after=await read();o.stops.push({label,activation,before,after,rig:pose.rig});expect(after.context).toEqual(before.context);expect(saved()).toEqual(preferences);retained(await sample(page),scene);return pose;}
    if(await page.locator(stopSelector).isEnabled())await stop('clear initial greeting');const gallery='[data-booky-gestures] > summary';await tap(gallery,'open gestures');await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expect(page.locator(noticeSelector)).toHaveCount(1);await expect(page.locator(noticeSelector)).toHaveText('');await expect(page.locator(noticeSelector+' p')).toHaveCount(0);await allEnabled('normal');
    await checked('reduced notice is readable and all fifteen gestures stay enabled',async()=>{await setMotion(true,'enter reduced motion');await allEnabled('reduced portrait');await notice('portrait reduced notice');await capture(page,result,testInfo,'booky-motion-notice-'+language+'-'+portrait.width+'.png');});
    await checked('explicit static pose repeats and Stop restores neutral',async()=>{
      const neutral=await character(page),first=await play('balance',true,'static balance');expect(first.rig).not.toEqual(neutral.rig);await still('first static balance');const second=await play('balance',true,'repeat static balance');expect(second.rig).toEqual(first.rig);await still('repeated static balance');const stopped=await stop('stop static balance');expect(stopped.rig).toEqual(neutral.rig);o.staticRepeat={first,second,neutral:neutral.rig};
    });
    await checked('active Dance settles on reduce and normal motion does not replay',async()=>{
      await setMotion(false,'restore before Dance');await expect(page.locator(noticeSelector+' p')).toHaveCount(0);const dance=await play('dance',false,'active dance');const clicked=dance.activation.events.find(e=>e.type==='click'&&e.gesture==='dance');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','true');const began=await page.evaluate(()=>performance.now());expect(began-clicked.at).toBeLessThan(2200);const reduced=await setMotion(true,'active Dance becomes static',180,true);expect(reduced.mediaRequestedAt-clicked.at).toBeLessThan(2200);expect(reduced.before.animating).toBe('true');expect(reduced.after.selected).toEqual(['dance']);
      const restored=await setMotion(false,'restore does not replay',2400);expect(restored.after.selected).toEqual(['dance']);await expect(page.locator(noticeSelector+' p')).toHaveCount(0);o.activeToggle={dance,mediaChangedAt:began,reduced,restored};const fresh=await play('dance',false,'fresh touch restarts dance');o.fresh=fresh;await stop('stop fresh dance');
    });
    await checked('short landscape reduced notice stays readable by touch',async()=>{
      await page.setViewportSize(landscape);await twoFrames(page);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await setMotion(true,'landscape reduced motion');await allEnabled('reduced landscape');await notice('landscape reduced notice');const stopTarget=await read(stopSelector,true),closeTarget=await read(closeSelector,true);o.landscapeHeader={stop:stopTarget,close:closeTarget};expect(stopTarget.card.height).toBeGreaterThanOrEqual(200);for(const target of [stopTarget,closeTarget]){expect(target.inside).toBe(true);expect(target.hits.every(value=>value.hit)).toBe(true);expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);}await capture(page,result,testInfo,'booky-motion-notice-'+language+'-'+landscape.width+'.png');o.landscapeClose=await tap(closeSelector,'close reduced landscape tips',true);await expect(panel(page)).toBeHidden();
    });
    await checked('trusted touch and source integrity',async()=>{o.events=await page.evaluate(()=>window.__motionNotice.events);expect(o.events.filter(e=>e.type==='click').every(e=>e.trusted&&e.pointerType==='touch')).toBe(true);expect(o.events.filter(e=>e.type==='click'&&e.gesture==='balance')).toHaveLength(2);expect(o.events.filter(e=>e.type==='click'&&e.gesture==='dance')).toHaveLength(2);expect(o.swipes.length).toBeGreaterThan(0);await fixture.verify();});
    result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{reducedMotionNoticeTracksMedia:true,reducedMotionNoticeReadableByTouch:true,allFifteenGesturesEnabledWithReducedMotion:true,reducedSelectedPoseRepeatAndStop:true,activeGestureSettlesOnReducedMotion:true,restoringMotionDoesNotReplay:true,freshTouchAnimatesAfterMotionRestore:true,motionTogglesPreserveContextAndPreferences:true,trustedTouchMotionNotice:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__motionNotice?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:568,height:320}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky short landscape companion navigation space '+language,async({},testInfo)=>{
  test.setTimeout(60000);const fixture=await open(testInfo),{page,result}=fixture;
  const o=result.observations.landscapeSpace={language,portrait,landscape,checks:[],findings:[],layouts:[],swipes:[],activations:[]};result.scenario='short-landscape-navigation-space-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message,stack:error.stack??null});o.findings.push(name);}};
  const stop='[data-booky-stop-gesture]',close='[data-planet-mascot-collapse]',toggle='[data-planet-mascot-toggle]',lastEdition='.globe-style-switch [data-globe-edition-option]:last-child';
  const saved=()=>({memory:[...fixture.memory],writes:mutations(fixture)}),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const read=selector=>page.evaluate(selector=>window.__landscapeSpace.read(selector),selector??null);
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.evaluate(()=>{
      const selectors='.native-planet-panel__header, .native-planet-app .atlas-immersive-chrome .interface-language-control, .native-planet-app .globe-controls, .native-planet-app .globe-scale-feedback, .native-planet-app .atlas-country-sheet-toggle, .native-planet-app .globe-style-switch, .native-planet-app .globe-edition-scroll-cue, .native-planet-app .globe-style-switch-toggle, .native-planet-app .globe-edition-compact-select, .native-planet-app .book-shelf-frame__navigation, .native-planet-app .book-detail-actions, .native-planet-app .archive-book-actions, .native-planet-app .atlas-country-presentation .panel-close, .native-planet-app .book-detail-page-navigation, .native-planet-app [data-planet-stand-toggle]';
      const box=r=>r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null;
      const state=window.__landscapeSpace={phase:'setup',events:[]};
      state.read=selector=>{
        const pet=document.querySelector('[data-planet-mascot-pet]'),card=document.querySelector('[data-planet-mascot-panel]'),rail=document.querySelector('.globe-style-switch'),target=selector?document.querySelector(selector):null,animations=new Set();
        const effective=element=>{const r=element.getBoundingClientRect(),bounds={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};let visible=!element.closest('[hidden],[inert],[aria-hidden="true"]'),clip=getComputedStyle(element).position!=='fixed';
          for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node),nr=node.getBoundingClientRect();if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)visible=false;
            if(node!==element&&node!==document.body&&node!==document.documentElement&&clip){if(/hidden|clip|scroll|auto/.test(style.overflowX)){bounds.left=Math.max(bounds.left,nr.left);bounds.right=Math.min(bounds.right,nr.right);}if(/hidden|clip|scroll|auto/.test(style.overflowY)){bounds.top=Math.max(bounds.top,nr.top);bounds.bottom=Math.min(bounds.bottom,nr.bottom);}}if(style.position==='fixed')clip=false;
            for(const animation of node.getAnimations()){const timing=animation.effect?.getComputedTiming();if((animation.pending||animation.playState==='running')&&Number.isFinite(timing?.endTime))animations.add(animation);}}
          return visible&&bounds.right-bounds.left>=2&&bounds.bottom-bounds.top>=2?{...bounds,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top}:null;};
        const navigation=[...document.querySelectorAll(selectors)].map(element=>({className:element.className,rect:effective(element)})).filter(value=>value.rect);
        const r=target?.getBoundingClientRect(),clip=target?effective(target):null,rect=box(r),heading=card?.querySelector('header');
        const points=r?[[.15,.5],[.5,.5],[.85,.5]].map(([x,y])=>{const point={x:r.left+r.width*x,y:r.top+r.height*y},hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&target.contains(hit),tag:hit?.tagName,className:typeof hit?.className==='string'?hit.className:null};}):[];
        return{at:performance.now(),viewport:{width:innerWidth,height:innerHeight},pet:box(pet?.getBoundingClientRect()),card:box(card?.getBoundingClientRect()),heading:box(heading?.getBoundingClientRect()),rail:box(rail?.getBoundingClientRect()),scrollLeft:rail?.scrollLeft,scrollWidth:rail?.scrollWidth,clientWidth:rail?.clientWidth,navigation,runningAnimations:animations.size,target:rect,effectiveTarget:clip,inside:!!rect&&!!clip&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5,hits:points,disabled:target?.disabled??false,gesture:pet?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),context:{mode:pet?.getAttribute('data-planet-mascot-mode'),route:pet?.getAttribute('data-planet-mascot-current-route'),step:pet?.getAttribute('data-planet-mascot-step'),screen:pet?.getAttribute('data-planet-mascot-screen')}};
      };
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click'])document.addEventListener(type,event=>{const element=event.target instanceof Element?event.target:null;state.events.push({at:performance.now(),phase:state.phase,type,trusted:event.isTrusted,pointerType:event.pointerType,edition:element?.closest('[data-globe-edition-option]')?.getAttribute('data-globe-edition-option')??null});},{capture:true,passive:true});
    });
    cdp=await page.context().newCDPSession(page);
    async function settle(label){const observation={label,samples:[]};o.layouts.push(observation);let previous,matches=0,last;
      await expect.poll(async()=>{last=await read();observation.samples.push(last);const key=JSON.stringify({viewport:last.viewport,pet:last.pet,card:last.card,rail:last.rail,navigation:last.navigation});matches=key===previous&&!last.runningAnimations?matches+1:0;previous=key;return matches;},{timeout:2500,intervals:[80]}).toBeGreaterThanOrEqual(3);return last;}
    function targetReady(value,label){expect(value.inside,label+' complete target').toBe(true);expect(value.target.width,label+' width').toBeGreaterThanOrEqual(44);expect(value.target.height,label+' height').toBeGreaterThanOrEqual(44);expect(value.hits.every(point=>point.hit),label+' three actual hit points').toBe(true);}
    async function tap(selector,label){const target=await read(selector);o.activations.push({label,target});targetReady(target,label);expect(target.disabled).toBe(false);const from=await page.evaluate(label=>{window.__landscapeSpace.phase=label;return window.__landscapeSpace.events.length;},label),x=(target.target.left+target.target.right)/2,y=(target.target.top+target.target.bottom)/2;
      await touch('touchStart',[{x,y,id:81}]);await touch('touchEnd',[]);await twoFrames(page);const events=await page.evaluate(from=>window.__landscapeSpace.events.slice(from),from);o.activations.at(-1).events=events;for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'),label+' trusted '+type).toBe(true);return target;}
    function clearance(value,label,open=true){expect(fits(value.pet,value.viewport)).toBe(true);expect([value.pet.width,value.pet.height]).toEqual([open?144:240,96]);if(open){expect(fits(value.card,value.viewport)).toBe(true);expect(value.card.height).toBeGreaterThanOrEqual(200);}else expect(value.card).toBeNull();
      const measured=value.navigation.map(control=>({className:control.className,rect:control.rect,area:Math.max(0,Math.min(value.pet.right,control.rect.right)-Math.max(value.pet.left,control.rect.left))*Math.max(0,Math.min(value.pet.bottom,control.rect.bottom)-Math.max(value.pet.top,control.rect.top))}));(o.clearance??=[]).push({label,pet:value.pet,controls:measured});expect(measured.filter(value=>value.area>0),label+' companion clears every visible navigation region').toEqual([]);}
    async function stopGreeting(label){await expect(page.locator(stop)).toBeEnabled();const before=await read(),preferences=saved(),scene=await sample(page);await tap(stop,label);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator(stop)).toBeDisabled();await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);expect((await read()).context).toEqual(before.context);expect(saved()).toEqual(preferences);retained(await sample(page),scene);}
    async function visibility(visible,label){
      const before=saved(),scene=await sample(page),record=JSON.parse(fixture.memory.get(BOOKY)??'null')??{schemaVersion:2,audience:'adult',visible:false,resume:null,progress:[]};
      await tap(visible?toggle:'[data-planet-mascot-hide]',label);await expect(avatar(page)).toHaveCount(visible?1:0);await expect(page.locator('[data-planet-mascot-preference-state]')).toHaveCount(0);await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(visible);await settle(label+' settled');
      const after=saved(),expected={...record,visible},writes=after.writes.slice(before.writes.length),observation={label,visible,before,after,expected,writes};(o.visibility??=[]).push(observation);expect(JSON.parse(fixture.memory.get(BOOKY))).toEqual(expected);expect(after.memory.filter(([key])=>key!==BOOKY)).toEqual(before.memory.filter(([key])=>key!==BOOKY));expect(writes).toHaveLength(1);expect(writes[0]).toEqual({operation:'set',key:BOOKY,value:fixture.memory.get(BOOKY)});retained(await sample(page),scene);
    }
    if(await avatar(page).count())await visibility(false,'initial explicit hide');
    const portraitBaseline=await settle('portrait hidden baseline'),initialScene=await sample(page);let preferences=saved();o.portraitBaseline=portraitBaseline;
    await page.setViewportSize(landscape);await settle('landscape hidden baseline');await stablePose(page);const hidden=await read(),landscapeScene=await sample(page);o.landscapeHiddenBaseline=hidden;expect(saved()).toEqual(preferences);retained(landscapeScene,initialScene,false);
    await checked('open landscape reserves full companion space and reachable header',async()=>{
      await visibility(true,'show landscape companion');preferences=saved();await expect(panel(page)).toBeVisible();await settle('landscape open');await live(page);const opened=await read();o.landscapeOpened=opened;clearance(opened,'open landscape');expect(opened.rail.width).toBeLessThan(hidden.rail.width);expect(hidden.rail.right-opened.rail.right).toBeGreaterThanOrEqual(144);
      targetReady(await read(stop),'landscape Stop');targetReady(await read(close),'landscape close');await stopGreeting('landscape Stop');o.openEditionSizes=await page.locator('.globe-style-switch [data-globe-edition-option]').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{edition:element.getAttribute('data-globe-edition-option'),width:r.width,height:r.height};}));for(const option of o.openEditionSizes){expect(option.width).toBeGreaterThanOrEqual(44);expect(option.height).toBeGreaterThanOrEqual(44);}expect(saved()).toEqual(preferences);retained(await sample(page),landscapeScene);await capture(page,result,testInfo,'booky-landscape-space-'+language+'-'+landscape.width+'-open.png');
    });
    await checked('closed companion stays clear and last edition is reachable by trusted touch scrolling',async()=>{
      await tap(close,'close landscape help');await expect(panel(page)).toBeHidden();const closed=await settle('landscape closed reserved');o.landscapeClosed=closed;clearance(closed,'closed landscape',false);expect(hidden.rail.right-closed.rail.right).toBeGreaterThanOrEqual(240);for(const selector of ['[data-planet-mascot-move]','[data-planet-mascot-hide]','[data-booky-walk]'])targetReady(await read(selector),'closed '+selector);await capture(page,result,testInfo,'booky-landscape-space-'+language+'-'+landscape.width+'-closed.png');expect(saved()).toEqual(preferences);retained(await sample(page),landscapeScene);
      for(let attempt=0;attempt<16;attempt++){const before=await read(lastEdition);if(before.inside&&before.hits.every(point=>point.hit))break;const r=before.rail;expect(r.width).toBeGreaterThan(140);const x=r.right-72,y=(r.top+r.bottom)/2,distance=r.width-144,from=await page.evaluate(()=>{window.__landscapeSpace.phase='edition rail swipe';return window.__landscapeSpace.events.length;});
        await touch('touchStart',[{x,y,id:71}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x:x-distance*step/8,y,id:71}]);await page.waitForTimeout(20);}await page.waitForTimeout(120);await touch('touchEnd',[]);
        let previous=-1,matches=0;await expect.poll(async()=>{const value=(await read()).scrollLeft;matches=Math.abs(value-previous)<.1?matches+1:0;previous=value;return matches;},{timeout:2000,intervals:[40]}).toBeGreaterThanOrEqual(3);
        const after=await read(lastEdition),events=await page.evaluate(from=>window.__landscapeSpace.events.slice(from),from);o.swipes.push({before,after,drag:{x,y,distance},events});expect(after.scrollLeft-before.scrollLeft).toBeGreaterThan(1);expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch')).toBe(true);expect(events.filter(event=>event.type==='click')).toEqual([]);clearance(await settle('after rail swipe '+attempt),'after rail swipe '+attempt,false);
      }
      const target=await read(lastEdition);o.lastEdition=target;targetReady(target,'last edition');expect(target.disabled).toBe(false);expect(o.swipes.length).toBeGreaterThan(0);expect(saved()).toEqual(preferences);retained(await sample(page),landscapeScene);
    });
    await checked('explicit hide and portrait rotation restore original rail geometry',async()=>{
      await visibility(false,'hide landscape companion');preferences=saved();const restored=await read();o.landscapeHiddenRestored=restored;expect(restored.rail).toEqual(hidden.rail);expect(await avatar(page).count()).toBe(0);
      await visibility(true,'show before portrait rotation');preferences=saved();await expect(panel(page)).toBeVisible();await settle('landscape reshown');await stopGreeting('reshown Stop');clearance(await read(),'reshown landscape');await page.setViewportSize(portrait);const portraitRestored=await settle('portrait help restored');await stablePose(page);o.portraitRestored=portraitRestored;expect(portraitRestored.rail).toEqual(portraitBaseline.rail);expect(fits(portraitRestored.pet,portrait)).toBe(true);expect(fits(portraitRestored.card,portrait)).toBe(true);expect(saved()).toEqual(preferences);retained(await sample(page),initialScene,false);await capture(page,result,testInfo,'booky-landscape-space-'+language+'-'+portrait.width+'-restored.png');
    });
    await checked('source scene and preferences remain exact',async()=>{o.events=await page.evaluate(()=>window.__landscapeSpace.events);expect(o.events.filter(event=>event.type==='click').every(event=>event.trusted&&event.pointerType==='touch')).toBe(true);expect(o.events.filter(event=>event.type==='click'&&event.edition)).toEqual([]);expect(saved()).toEqual(preferences);await fixture.verify();});
    result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{landscapeCompanionClearsAllNavigation:true,landscapeHeaderControlsReachableByTouch:true,landscapeLastEditionReachableByTouch:true,landscapeRailRestoresAfterHide:true,portraitRailRestoresAfterRotation:true,landscapeSpacePreservesSceneAndPreferences:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__landscapeSpace?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:568,height:320}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky mobile gesture quick access '+language,async({},testInfo)=>{
  test.setTimeout(75000);const fixture=await open(testInfo),{page,result}=fixture;
  const o=result.observations.gestureAccess={language,portrait,landscape,checks:[],findings:[],swipes:[],accesses:[],orders:[],plays:[],stops:[],settles:[],stillness:[],invariants:[]};result.scenario='mobile-gesture-quick-access-'+language;let cdp;
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message,stack:error.stack??null});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory],writes:mutations(fixture)}),read=(selector=null,header=false)=>page.evaluate(({selector,header})=>window.__gestureAccess.read(selector,header),{selector,header}),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  try{
    await page.setViewportSize(portrait);await ready(page);
    if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());
    await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');
    await page.evaluate(()=>{
      const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const state=window.__gestureAccess={phase:'setup',events:[]};
      state.read=(selector,header=false)=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,p=document.querySelector('[data-planet-mascot-pet]'),highlight=document.querySelector('[data-planet-mascot-highlight]');
        const r=box(card),h=box(heading),rect=box(target),clip=r?{left:Math.max(0,r.left+2),right:Math.min(innerWidth,r.right-2),top:Math.max(0,r.top+2,header?0:h?.bottom??0),bottom:Math.min(innerHeight,r.bottom-2)}:null;
        const points=rect?[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+4,y:rect.top+4},{x:rect.right-4,y:rect.bottom-4}]:[];
        const ancestorScroll=[];for(let node=card?.parentElement;node;node=node.parentElement)ancestorScroll.push({tag:node.tagName,id:node.id,left:node.scrollLeft,top:node.scrollTop});return{ancestorScroll,documentScroll:{x:scrollX,y:scrollY,left:document.scrollingElement.scrollLeft,top:document.scrollingElement.scrollTop},runningAnimations:document.getAnimations().filter(a=>(a.pending||a.playState==='running')&&Number.isFinite(a.effect?.getComputedTiming().endTime)).length,at:performance.now(),viewport:{width:innerWidth,height:innerHeight},card:r,heading:h,clip,target:rect,inside:!!rect&&!!clip&&rect.width>0&&rect.height>0&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5,hits:points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),tag:hit?.tagName};}),scrollTop:card?.scrollTop,gesture:p?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),context:{pet:box(p),mode:p?.getAttribute('data-planet-mascot-mode'),route:p?.getAttribute('data-planet-mascot-current-route'),step:p?.getAttribute('data-planet-mascot-step'),screen:p?.getAttribute('data-planet-mascot-screen'),panel:p?.getAttribute('data-planet-mascot-panel-state'),highlight:highlight?.getAttribute('data-planet-mascot-highlight')??null,highlightRect:box(highlight)},selected:[...document.querySelectorAll('[data-booky-gesture][aria-pressed="true"]')].map(element=>element.getAttribute('data-booky-gesture')),disabled:target?.disabled??false};};
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','touchmove'])document.addEventListener(type,e=>{const t=e.target instanceof Element?e.target:null,control=t?.closest('[data-booky-open-gestures],[data-booky-stop-gesture],[data-planet-mascot-collapse],[data-booky-gesture],[data-booky-surprise],[data-planet-mascot-route],[data-planet-mascot-finish]');state.events.push({at:performance.now(),phase:state.phase,type,trusted:e.isTrusted,pointerType:e.pointerType,quick:!!control?.hasAttribute('data-booky-open-gestures'),stop:!!control?.hasAttribute('data-booky-stop-gesture'),close:!!control?.hasAttribute('data-planet-mascot-collapse'),gesture:control?.getAttribute('data-booky-gesture')??null,surprise:!!control?.hasAttribute('data-booky-surprise'),insidePanel:!!t?.closest('[data-planet-mascot-panel]')});},{capture:true,passive:true});
    });
    cdp=await page.context().newCDPSession(page);
    async function expose(selector){
      for(let attempt=0;attempt<32;attempt++){
        const before=await read(selector);if(before.inside&&before.hits.every(point=>point.hit))return before;
        expect(before.target,'Displayed touch target '+selector).not.toBeNull();expect(before.clip).not.toBeNull();
        const space=before.clip.bottom-before.clip.top;expect(space).toBeGreaterThan(56);expect(before.target.height).toBeLessThanOrEqual(space);
        const upward=before.target.bottom>before.clip.bottom,overflow=upward?before.target.bottom-before.clip.bottom:before.clip.top-before.target.top;
        const distance=Math.min(space-24,Math.max(32,overflow+18)),x=(before.clip.left+before.clip.right)/2,startY=upward?before.clip.bottom-12:before.clip.top+12,endY=startY+(upward?-distance:distance);
        const start=await page.evaluate(selector=>{window.__gestureAccess.phase='scroll '+selector;return window.__gestureAccess.events.length;},selector);
        await touch('touchStart',[{x,y:startY,id:71}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:startY+(endY-startY)*step/8,id:71}]);await page.waitForTimeout(20);}await page.waitForTimeout(120);await touch('touchEnd',[]);
        let previous=-1,matches=0;await expect.poll(async()=>{const at=(await read()).scrollTop;matches=Math.abs(at-previous)<.1?matches+1:0;previous=at;return matches;},{timeout:2000,intervals:[40]}).toBeGreaterThanOrEqual(2);
        const after=await read(selector),events=await page.evaluate(from=>window.__gestureAccess.events.slice(from),start);o.swipes.push({selector,before,after,drag:{x,startY,endY,distance},events});
        expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch')).toBe(true);expect(events.filter(event=>event.type==='click')).toEqual([]);
        expect(Math.abs(after.scrollTop-before.scrollTop)).toBeGreaterThan(1);expect(after.gesture).toBe(before.gesture);expect(after.animating).toBe('false');expect(after.documentScroll).toEqual(before.documentScroll);expect(after.ancestorScroll).toEqual(before.ancestorScroll);
      }
      const final=await read(selector);if(final.inside&&final.hits.every(point=>point.hit))return final;
      throw Error('Trusted touch could not expose '+selector);
    }
    async function tap(selector,label,header=false){
      const target=header?await read(selector,true):await expose(selector);expect(target.inside).toBe(true);expect(target.hits.every(point=>point.hit)).toBe(true);expect(target.disabled).toBe(false);expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);
      const start=await page.evaluate(label=>{window.__gestureAccess.phase=label;return window.__gestureAccess.events.length;},label),x=(target.target.left+target.target.right)/2,y=(target.target.top+target.target.bottom)/2;
      await touch('touchStart',[{x,y,id:81}]);await touch('touchEnd',[]);await twoFrames(page);
      const events=await page.evaluate(from=>window.__gestureAccess.events.slice(from),start);for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch')).toBe(true);
      return{target,events};
    }

    const shortcut='[data-booky-open-gestures]',summary='[data-booky-gestures] > summary',surprise='[data-booky-surprise]',stopSelector='[data-booky-stop-gesture]';
    const semantic=value=>{const {pet,...context}=value.context;return context;};
    async function settle(label,staticOnly=false){const observation={label,staticOnly,samples:[]};o.settles.push(observation);let previous,matches=0,last;await expect.poll(async()=>{last=await read();observation.samples.push(last);const key=JSON.stringify({pet:last.context.pet,card:last.card,heading:last.heading,scrollTop:last.scrollTop});matches=key===previous&&!last.runningAnimations?matches+1:0;previous=key;return matches;},{timeout:2500,intervals:[80]}).toBeGreaterThanOrEqual(3);if(staticOnly)expect(observation.samples.every(value=>value.animating==='false')).toBe(true);return last;}
    async function still(label,wait=180){await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);const before=await character(page);await page.waitForTimeout(wait);const after=await character(page);o.stillness.push({label,wait,framesBefore:before.renderedFrames,framesAfter:after.renderedFrames,rigBefore:before.rig,rigAfter:after.rig});expect(after.renderedFrames).toBe(before.renderedFrames);expect(after.rig).toEqual(before.rig);return after;}
    async function invariant(label,baseline){const after={state:await read(),preferences:saved(),scene:await sample(page)};o.invariants.push({label,before:baseline,after});expect(semantic(after.state)).toEqual(semantic(baseline.state));expect(after.state.documentScroll).toEqual(baseline.state.documentScroll);expect(after.state.ancestorScroll).toEqual(baseline.state.ancestorScroll);expect(after.preferences).toEqual(baseline.preferences);retained(after.scene,baseline.scene);return after;}
    const baseline=async()=>({state:await read(),preferences:saved(),scene:await sample(page)});
    async function stop(label){const before=await baseline(),activation=await tap(stopSelector,label,true);await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator('[data-booky-gesture][aria-pressed="true"]')).toHaveCount(0);await expect(page.locator(stopSelector)).toBeDisabled();const pose=await still(label);o.stops.push({label,activation,pose});await invariant(label,before);}
    async function access(label){
      await expect(page.locator(shortcut)).toHaveText(language==='ru'?'Поиграть с Книжуликом':'Play with Mr. Booky');await expose(shortcut);if(label==='portrait quick access')await capture(page,result,testInfo,'booky-gesture-access-'+language+'-'+portrait.width+'.png');const before=await baseline(),activation=await tap(shortcut,label);
      await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expect(page.locator(summary)).toBeFocused();await settle(label+' gallery opened',true);const after=await read(summary);o.accesses.push({label,before,activation,after});expect(after.inside).toBe(true);expect(after.hits.every(point=>point.hit)).toBe(true);expect(after.scrollTop-before.state.scrollTop).toBeGreaterThan(1);expect(after.gesture).toBe(before.state.gesture);await invariant(label,before);
      const buttons=await page.locator('[data-booky-gestures] .planet-mascot-controls__actions > button').evaluateAll(elements=>elements.map(element=>({surprise:element.hasAttribute('data-booky-surprise'),gesture:element.getAttribute('data-booky-gesture'),disabled:element.disabled,text:element.textContent.trim()})));o.orders.push({label,buttons});expect(buttons).toHaveLength(16);expect(buttons[0].surprise).toBe(true);expect(buttons.slice(1).every(value=>value.gesture&&!value.disabled&&value.text)).toBe(true);expect(new Set(buttons.slice(1).map(value=>value.gesture)).size).toBe(15);const target=await expose(surprise);expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);return target;
    }
    async function play(reduced,label){const before=await character(page),activation=await tap(surprise,label);await expect(pet(page)).not.toHaveAttribute('data-planet-mascot-gesture','rest');const state=await read();expect(state.selected).toEqual([state.gesture]);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating',reduced?'false':'true');const after=await character(page),observation={label,reduced,activation,gesture:state.gesture,framesBefore:before.renderedFrames,framesAfter:after.renderedFrames,rig:after.rig};o.plays.push(observation);expect(after.renderedFrames).toBeGreaterThan(before.renderedFrames);return observation;}
    if(await page.locator(stopSelector).isEnabled())await stop('clear initial greeting');await settle('portrait baseline',true);const initial=await baseline();
    await checked('portrait shortcut opens focused gallery and Surprise is the first reachable action',async()=>{await access('portrait quick access');});
    await checked('trusted Surprise completes then repeats differently and Stop remains reachable',async()=>{
      const first=await play(false,'first normal Surprise');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false',{timeout:3000});await still('natural finite Surprise');const second=await play(false,'second normal Surprise');expect(second.gesture).not.toBe(first.gesture);await stop('stop second Surprise');await invariant('portrait actions',initial);
    });
    await checked('landscape shortcut preserves context and reduced poses restart only on touch',async()=>{
      await tap('[data-planet-mascot-collapse]','close before rotation',true);await expect(panel(page)).toBeHidden();await page.setViewportSize(landscape);await twoFrames(page);await stablePose(page);const rotatedScene=await sample(page);retained(rotatedScene,initial.scene,false);expect(saved()).toEqual(initial.preferences);
      await page.locator('[data-planet-mascot-toggle]').tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await settle('landscape reopened');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');if(await page.locator(stopSelector).isEnabled())await stop('clear reopened greeting');
      const beforeReduce=await baseline();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','true');expect((await read()).animating).toBe('false');await settle('reduced landscape settled',true);await still('reduced entry');await invariant('enter reduced motion',beforeReduce);
      const landscapeBaseline=await baseline();await access('landscape quick access');const first=await play(true,'first static Surprise');await still('first static Surprise');const second=await play(true,'second static Surprise');expect(second.gesture).not.toBe(first.gesture);await still('second static Surprise');await capture(page,result,testInfo,'booky-gesture-access-'+language+'-'+landscape.width+'.png');await stop('stop static Surprise');await invariant('landscape static actions',landscapeBaseline);
      const beforeRestore=await baseline();await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion','false');expect((await read()).animating).toBe('false');await settle('normal motion restored',true);await still('restore does not replay',300);await invariant('restore normal motion',beforeRestore);await play(false,'explicit fresh normal Surprise');await stop('stop fresh normal Surprise');expect(saved()).toEqual(initial.preferences);retained(await sample(page),rotatedScene);
    });
    await checked('all input is trusted and scrolling stays within the help panel',async()=>{o.events=await page.evaluate(()=>window.__gestureAccess.events);expect(o.events.filter(event=>event.type==='click').every(event=>event.trusted&&event.pointerType==='touch')).toBe(true);expect(o.events.filter(event=>event.type==='click'&&event.quick)).toHaveLength(2);expect(o.events.filter(event=>event.type==='click'&&event.surprise)).toHaveLength(5);expect(o.swipes.length).toBeGreaterThan(0);for(const swipe of o.swipes)expect(swipe.after.documentScroll).toEqual(swipe.before.documentScroll);expect((await read()).documentScroll).toEqual(initial.state.documentScroll);expect(saved()).toEqual(initial.preferences);await fixture.verify();});
    result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{quickAccessOpensAndFocusesGallery:true,surpriseIsFirstReachableAction:true,trustedTouchSurpriseFiniteAndDifferent:true,quickAccessStopRemainsReachable:true,quickAccessReducedMotionStaticAndManualRestart:true,quickAccessPreservesScenePreferencesAndContext:true,quickAccessScrollConfinedToPanel:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.events=await page.evaluate(()=>window.__gestureAccess?.events??[]).catch(()=>[]);await fixture.close();}
});

for(const [language,viewport]of[['ru',{width:390,height:844}],['en',{width:320,height:844}]])test('Booky persistent calm movements touch '+language,async({},testInfo)=>{
  test.setTimeout(90000);const motionKey='probpera-booky-motion-v1',fixture=await open(testInfo,{allowedPreferenceKeys:[motionKey]}),{page,result}=fixture;
  const o=result.observations.calmMotion={language,viewport,checks:[],findings:[],activations:[],swipes:[],stillness:[],preferences:[],media:[],lifecycles:[],eventSegments:[]};result.scenario='persistent-calm-movements-touch-'+language;let cdp;
  const calm='[data-booky-calm-motion]',surprise='[data-booky-surprise]',stop='[data-booky-stop-gesture]',close='[data-planet-mascot-collapse]',toggle='[data-planet-mascot-toggle]';
  const checked=async(name,fn)=>{try{await fn();o.checks.push({name,pass:true});}catch(error){o.checks.push({name,pass:false,error:error.message,stack:error.stack??null});o.findings.push(name);}};
  const saved=()=>({memory:[...fixture.memory].filter(([key])=>key!==motionKey),writes:mutations(fixture).filter(value=>value.key!==motionKey)});
  const motionWrites=()=>mutations(fixture).filter(value=>value.key===motionKey),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const read=(selector=null,scope='card')=>page.evaluate(({selector,scope})=>window.__calmMotion.read(selector,scope),{selector,scope});
  async function observe(){await page.evaluate(()=>{
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const state=window.__calmMotion={phase:'setup',events:[]};
    state.read=(selector,scope)=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,p=document.querySelector('[data-planet-mascot-pet]'),canvas=document.querySelector('[data-booky-canvas]'),leaf=document.querySelector('[data-planet-mascot-leaf]');
      const r=box(card),h=box(heading),rect=box(target),clip=scope==='viewport'?{left:0,right:innerWidth,top:0,bottom:innerHeight}:r?{left:Math.max(0,r.left+2),right:Math.min(innerWidth,r.right-2),top:Math.max(0,r.top+2,scope==='header'?0:h?.bottom??0),bottom:Math.min(innerHeight,r.bottom-2)}:null;
      const roundedAvatar=!!target?.matches('.planet-mascot-controls__avatar-button[data-planet-mascot-toggle]'),targetStyle=target?getComputedStyle(target):null,shape=targetStyle?{roundedAvatar,borderRadius:targetStyle.borderRadius,clipPath:targetStyle.clipPath,overflow:targetStyle.overflow}:null;
      const points=rect?(roundedAvatar?[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+rect.width*.3,y:rect.top+rect.height/2},{x:rect.left+rect.width*.7,y:rect.top+rect.height/2}]:[{x:rect.left+rect.width/2,y:rect.top+rect.height/2},{x:rect.left+4,y:rect.top+4},{x:rect.right-4,y:rect.bottom-4}]):[];
      const ancestors=[];for(let node=card?.parentElement;node;node=node.parentElement)ancestors.push({tag:node.tagName,id:node.id,left:node.scrollLeft,top:node.scrollTop});
      return{at:performance.now(),card:r,heading:h,clip,target:rect,shape,runningAnimations:document.getAnimations().filter(animation=>(animation.pending||animation.playState==='running')&&Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>({target:animation.effect?.target?.className??null,currentTime:animation.currentTime,endTime:animation.effect?.getComputedTiming().endTime,playState:animation.playState,pending:animation.pending})),inside:!!rect&&!!clip&&rect.width>0&&rect.height>0&&rect.left>=clip.left-.5&&rect.right<=clip.right+.5&&rect.top>=clip.top-.5&&rect.bottom<=clip.bottom+.5,hits:points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),tag:hit?.tagName};}),scrollTop:card?.scrollTop,documentScroll:{x:scrollX,y:scrollY,left:document.scrollingElement.scrollLeft,top:document.scrollingElement.scrollTop},ancestors,
        gesture:p?.getAttribute('data-planet-mascot-gesture'),animating:canvas?.getAttribute('data-booky-animating'),reduced:canvas?.getAttribute('data-booky-reduced-motion'),systemReduced:matchMedia('(prefers-reduced-motion: reduce)').matches,calmChecked:document.querySelector('[data-booky-calm-motion]')?.getAttribute('aria-checked'),disabled:target?.disabled??false,
        context:{mode:p?.getAttribute('data-planet-mascot-mode'),route:p?.getAttribute('data-planet-mascot-current-route'),step:p?.getAttribute('data-planet-mascot-step'),screen:p?.getAttribute('data-planet-mascot-screen'),panel:p?.getAttribute('data-planet-mascot-panel-state')},pet:box(p),leaf:leaf?{animation:getComputedStyle(leaf).animationName,duration:getComputedStyle(leaf).animationDuration}:null,
        selected:[...document.querySelectorAll('[data-booky-gesture][aria-pressed="true"]')].map(element=>element.getAttribute('data-booky-gesture'))};};
    for(const type of ['pointerdown','pointerup','pointercancel','click','touchmove'])document.addEventListener(type,event=>{const target=event.target instanceof Element?event.target:null,control=target?.closest('[data-booky-calm-motion],[data-booky-stop-gesture],[data-planet-mascot-collapse],[data-booky-gesture],[data-booky-surprise],[data-booky-open-gestures],[data-planet-mascot-toggle],[data-booky-walk],[data-booky-motion-retry],[data-booky-motion-recover]');state.events.push({at:performance.now(),phase:state.phase,type,trusted:event.isTrusted,pointerType:event.pointerType,calm:!!control?.hasAttribute('data-booky-calm-motion'),retry:!!control?.hasAttribute('data-booky-motion-retry'),recover:!!control?.hasAttribute('data-booky-motion-recover'),stop:!!control?.hasAttribute('data-booky-stop-gesture'),surprise:!!control?.hasAttribute('data-booky-surprise'),gesture:control?.getAttribute('data-booky-gesture')??null,walk:!!control?.hasAttribute('data-booky-walk'),insidePanel:!!target?.closest('[data-planet-mascot-panel]')});},{capture:true,passive:true});
  });}
  async function expose(selector){
    for(let attempt=0;attempt<32;attempt++){
      const before=await read(selector);if(before.inside&&before.hits.every(point=>point.hit))return before;
      expect(before.target,'Displayed touch target '+selector).not.toBeNull();expect(before.clip).not.toBeNull();const space=before.clip.bottom-before.clip.top;expect(space).toBeGreaterThan(56);expect(before.target.height).toBeLessThanOrEqual(space);
      const upward=before.target.bottom>before.clip.bottom,overflow=upward?before.target.bottom-before.clip.bottom:before.clip.top-before.target.top,distance=Math.min(space-24,Math.max(32,overflow+18)),x=(before.clip.left+before.clip.right)/2,startY=upward?before.clip.bottom-12:before.clip.top+12,endY=startY+(upward?-distance:distance);
      const start=await page.evaluate(selector=>{window.__calmMotion.phase='scroll '+selector;return window.__calmMotion.events.length;},selector);
      await touch('touchStart',[{x,y:startY,id:101}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:startY+(endY-startY)*step/8,id:101}]);await page.waitForTimeout(20);}await page.waitForTimeout(120);await touch('touchEnd',[]);
      let previous=-1,matches=0;await expect.poll(async()=>{const top=(await read()).scrollTop;matches=Math.abs(top-previous)<.1?matches+1:0;previous=top;return matches;},{timeout:2000,intervals:[40]}).toBeGreaterThanOrEqual(2);
      const after=await read(selector),events=await page.evaluate(from=>window.__calmMotion.events.slice(from),start);o.swipes.push({selector,before,after,events});expect(events.some(event=>event.type==='pointercancel'&&event.trusted&&event.pointerType==='touch')).toBe(true);expect(events.filter(event=>event.type==='click')).toEqual([]);expect(Math.abs(after.scrollTop-before.scrollTop)).toBeGreaterThan(1);expect(after.documentScroll).toEqual(before.documentScroll);expect(after.ancestors).toEqual(before.ancestors);
    }
    throw Error('Trusted touch could not expose '+selector);
  }
  async function tap(selector,label,{scope='card',active=false,disabled=false,exposed=false}={}){
    const target=scope==='card'&&!exposed?await expose(selector):await read(selector,scope),observation={label,selector,target,events:[],after:null};o.activations.push(observation);expect(target.inside,label+' fully visible').toBe(true);expect(target.hits.every(point=>point.hit),label+' unobstructed').toBe(true);expect(target.disabled).toBe(disabled);expect(target.target.width).toBeGreaterThanOrEqual(44);expect(target.target.height).toBeGreaterThanOrEqual(44);if(active)expect(target.animating,label+' gesture active immediately before input').toBe('true');
    const start=await page.evaluate(label=>{window.__calmMotion.phase=label;return window.__calmMotion.events.length;},label),x=(target.target.left+target.target.right)/2,y=(target.target.top+target.target.bottom)/2;
    await touch('touchStart',[{x,y,id:102}]);await touch('touchEnd',[]);await twoFrames(page);const events=await page.evaluate(from=>window.__calmMotion.events.slice(from),start);
    for(const type of disabled?['pointerdown','pointerup']:['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'),label+' trusted '+type).toBe(true);if(disabled)expect(events.filter(event=>event.type==='click')).toEqual([]);
    Object.assign(observation,{events,after:await read()});return observation;
  }
  async function still(label,wait=300){await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await twoFrames(page);const before=await character(page),position=(await read()).pet;await page.waitForTimeout(wait);const after=await character(page),state=await read();o.stillness.push({label,wait,framesBefore:before.renderedFrames,framesAfter:after.renderedFrames,rigBefore:before.rig,rigAfter:after.rig,positionBefore:position,positionAfter:state.pet});expect(after.renderedFrames,label+' no animation frames').toBe(before.renderedFrames);expect(after.rig).toEqual(before.rig);expect(state.pet).toEqual(position);return after;}
  async function settleLayout(){let previous,matches=0;const observation={samples:[]};(o.layouts??=[]).push(observation);await expect.poll(async()=>{const state=await read(),key=JSON.stringify({pet:state.pet,card:state.card,scrollTop:state.scrollTop});observation.samples.push({at:state.at,pet:state.pet,card:state.card,scrollTop:state.scrollTop,runningAnimations:state.runningAnimations});matches=key===previous&&!state.runningAnimations.length?matches+1:0;previous=key;return matches;},{timeout:3500,intervals:[80]}).toBeGreaterThanOrEqual(3);}
  async function preference(mode){await expect.poll(()=>fixture.memory.get(motionKey)).toBe(mode);await expect(page.locator(calm)).toHaveAttribute('aria-checked',String(mode==='calm'));await expect(page.locator('[data-booky-motion-save-status]')).toHaveText('');o.preferences.push({mode,writes:motionWrites(),state:await read()});}
  async function stopGesture(label){await tap(stop,label,{scope:'header'});await expect(pet(page)).toHaveAttribute('data-planet-mascot-gesture','rest');await expect(page.locator(stop)).toBeDisabled();await still(label);}
  async function gallery(label){await tap('[data-booky-open-gestures]',label);await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expose(calm);await expect(page.locator(calm)).toBeEnabled();}
  async function reduced(expected){await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-reduced-motion',String(expected));}
  try{
    await page.setViewportSize(viewport);await ready(page);if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await expect(page.locator('html')).toHaveAttribute('lang','en');await ready(page);}
    await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await page.locator(toggle).tap();await expect(panel(page)).toBeVisible();await companionSaved(fixture);await live(page);await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','false');await observe();cdp=await page.context().newCDPSession(page);if(await page.locator(stop).isEnabled())await stopGesture('clear setup greeting');await gallery('open calm preference gallery');await settleLayout();
    const originalPreferences=saved(),originalScene=await sample(page);o.initial={preferences:originalPreferences,scene:originalScene,state:await read()};
    await checked('default system setting is localized and does not write a preference',async()=>{await expect(page.locator(calm)).toHaveAttribute('role','switch');await expect(page.locator(calm)).toHaveAccessibleName(language==='ru'?'Спокойные движения':'Calm movements');await expect(page.locator(calm)).toHaveAttribute('aria-checked','false');await reduced(false);expect((await read()).systemReduced).toBe(false);expect(fixture.memory.has(motionKey)).toBe(false);expect(motionWrites()).toEqual([]);expect(saved()).toEqual(originalPreferences);});
    await checked('trusted calm toggle settles an active gesture and preserves its selected pose',async()=>{
      await expose(surprise);const paired=await read(calm);expect(paired.inside).toBe(true);expect(paired.hits.every(point=>point.hit)).toBe(true);const before=await read(),played=await tap(surprise,'normal Surprise before calm',{exposed:true});await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','true');const active=await read(),enabled=await tap(calm,'enable calm during active gesture',{active:true,exposed:true});await preference('calm');await reduced(true);const after=await read();o.activeToggle={before,played,active,enabled,after};expect(active.gesture).not.toBe('rest');expect(after.gesture).toBe(active.gesture);expect(after.selected).toEqual([active.gesture]);expect(after.context).toEqual(before.context);expect(after.systemReduced).toBe(false);await settleLayout();await still('explicit calm active gesture settles',2400);expect((await read()).leaf.animation).toBe('none');expect(saved()).toEqual(originalPreferences);retained(await sample(page),originalScene);
      const buttons=await page.locator('[data-booky-gesture]').evaluateAll(elements=>elements.map(element=>({gesture:element.getAttribute('data-booky-gesture'),disabled:element.disabled})));o.availableGestures=buttons;expect(buttons).toHaveLength(15);expect(buttons.every(value=>!value.disabled)).toBe(true);await expose(calm);await capture(page,result,testInfo,'booky-calm-motion-'+language+'-'+viewport.width+'-enabled.png');
    });
    await checked('system reduced motion takes precedence and disabling calm never replays a gesture',async()=>{
      const before=await read(),writes=motionWrites();await page.emulateMedia({reducedMotion:'reduce'});await reduced(true);await still('system reduce while calm');expect(motionWrites()).toEqual(writes);const disabled=await tap(calm,'disable calm while system reduces motion');await preference('system');await reduced(true);const effective=await read();expect(effective.systemReduced).toBe(true);expect(effective.gesture).toBe(before.gesture);expect(effective.selected).toEqual(before.selected);await still('system precedence after disabling calm');
      await page.emulateMedia({reducedMotion:'no-preference'});await reduced(false);await settleLayout();const restored=await read();await still('normal motion restored without automatic replay',2400);expect(restored.gesture).toBe(before.gesture);expect(restored.selected).toEqual(before.selected);expect(restored.systemReduced).toBe(false);o.media.push({before,disabled,effective,restored});expect(saved()).toEqual(originalPreferences);retained(await sample(page),originalScene);
    });
    await checked('only a fresh trusted gesture restarts animation after calm is disabled',async()=>{const before=await character(page),activation=await tap(surprise,'fresh normal Surprise');await expect(page.locator('[data-booky-canvas]')).toHaveAttribute('data-booky-animating','true');const active=await character(page);o.manualRestart={activation,framesBefore:before.renderedFrames,framesActive:active.renderedFrames};expect(active.renderedFrames).toBeGreaterThan(before.renderedFrames);await stopGesture('stop fresh normal Surprise');expect(saved()).toEqual(originalPreferences);retained(await sample(page),originalScene);});
    await checked('calm disables the actual closed-help walking control without changing saved progress',async()=>{await tap(calm,'save calm for walking and lifecycle');await preference('calm');await reduced(true);await tap(close,'close calm tips',{scope:'header'});await expect(panel(page)).toBeHidden();await settleLayout();await expect(page.locator('[data-booky-walk]')).toBeDisabled();await tap('[data-booky-walk]','touch disabled calm walk',{scope:'viewport',disabled:true});await expect(page.locator('[data-booky-walk-stop]')).toHaveCount(0);await still('disabled calm walk remains still');expect(saved()).toEqual(originalPreferences);retained(await sample(page),originalScene);});
    await checked('saved calm survives native background resume under normal OS motion',async()=>{
      const before=await sample(page),writes=motionWrites();await page.evaluate(()=>window.__bookyLiveFixture.setVisible(false));await expect(pet(page)).toHaveCount(0);await page.evaluate(()=>window.__bookyLiveFixture.setVisible(true));await ready(page);await live(page);await reduced(true);await settleLayout();await still('resumed saved calm stays still');expect((await read()).systemReduced).toBe(false);await expect(page.locator('[data-booky-walk]')).toBeDisabled();expect(motionWrites()).toEqual(writes);expect(saved()).toEqual(originalPreferences);const after=await sample(page);retained(after,before);o.lifecycles.push({kind:'native-background-resume',before,after,state:await read(),writes:motionWrites()});
    });
    await checked('saved calm survives a full reload without new or legacy preference writes',async()=>{
      o.eventSegments.push({label:'before reload',events:await page.evaluate(()=>window.__calmMotion.events)});const before=await sample(page),writes=motionWrites();await page.reload();await ready(page);await stablePose(page);await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await observe();await live(page);await reduced(true);await settleLayout();await still('reloaded saved calm stays still');const after=await sample(page);expect(after.selection).toEqual(before.selection);expect(after.url).toBe(before.url);expect((await read()).systemReduced).toBe(false);await expect(page.locator('[data-booky-walk]')).toBeDisabled();expect(motionWrites()).toEqual(writes);expect(saved()).toEqual(originalPreferences);
      await tap(toggle,'open reloaded calm help',{scope:'viewport'});await expect(panel(page)).toBeVisible();await gallery('open reloaded calm gallery');await expect(page.locator(calm)).toHaveAttribute('aria-checked','true');await reduced(true);await settleLayout();await still('reloaded gallery remains static');await capture(page,result,testInfo,'booky-calm-motion-'+language+'-'+viewport.width+'-reloaded.png');o.lifecycles.push({kind:'full-reload',before,after,state:await read(),writes:motionWrites()});retained(await sample(page),after);expect(saved()).toEqual(originalPreferences);
    });
    await checked('malformed motion data stays unchanged on retry and recovers only after explicit trusted consent',async()=>{
      o.eventSegments.push({label:'before malformed reload',events:await page.evaluate(()=>window.__calmMotion.events)});const raw='malformed-calm-motion-fixture',writes=motionWrites(),beforeReload=await sample(page);o.recovery={controlledPreferenceInput:{key:motionKey,previousValue:fixture.memory.get(motionKey),value:raw,kind:'malformed stored value supplied through the existing native OS preference port'},writesBefore:writes};fixture.memory.set(motionKey,raw);
      await page.reload();await ready(page);await stablePose(page);await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await observe();await live(page);await reduced(true);await settleLayout();await still('failed motion read remains quiet');const failedScene=await sample(page);expect(failedScene.selection).toEqual(beforeReload.selection);expect(failedScene.url).toBe(beforeReload.url);expect((await read()).systemReduced).toBe(false);expect(fixture.memory.get(motionKey)).toBe(raw);expect(motionWrites()).toEqual(writes);expect(saved()).toEqual(originalPreferences);
      await tap(toggle,'open failed motion help',{scope:'viewport'});await expect(panel(page)).toBeVisible();await tap('[data-booky-open-gestures]','open failed motion gallery');await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await expose(calm);await expect(page.locator(calm)).toBeDisabled();await expect(page.locator(calm)).toHaveAttribute('aria-checked','false');const retry='[data-booky-motion-retry]',recover='[data-booky-motion-recover]',status='[data-booky-motion-save-status]',failureCopy=language==='ru'?'Не удалось прочитать настройку. Пока движения уменьшены.':'The setting could not be read. Movements are reduced for now.';
      await expect(page.locator(status)).toHaveText(failureCopy);await expect(page.locator(retry)).toBeEnabled();await expect(page.locator(recover)).toBeEnabled();await expect(page.locator(recover)).toHaveAccessibleName(language==='ru'?'Заменить на спокойные движения':'Replace with calm movements');await expect(page.locator(recover)).toHaveAccessibleDescription(language==='ru'?'Можно заменить только эту настройку на спокойные движения. Остальные настройки и прогресс сохранятся.':'You can replace just this setting with calm movements. Your other settings and progress will stay.');o.recovery.failedState=await read();o.recovery.recoverTarget=await expose(recover);await capture(page,result,testInfo,'booky-calm-motion-'+language+'-'+viewport.width+'-read-failed.png');
      const readsBefore=fixture.operations.filter(value=>value.operation==='get'&&value.key===motionKey).length;o.recovery.retry=await tap(retry,'retry malformed motion read');await expect.poll(()=>fixture.operations.filter(value=>value.operation==='get'&&value.key===motionKey).length).toBe(readsBefore+1);await expect(page.locator(status)).toHaveText(failureCopy);await expect(page.locator(calm)).toBeDisabled();await expect(page.locator(recover)).toBeEnabled();expect(fixture.memory.get(motionKey)).toBe(raw);expect(motionWrites()).toEqual(writes);expect(saved()).toEqual(originalPreferences);await reduced(true);await settleLayout();await still('failed motion retry remains quiet');retained(await sample(page),failedScene);o.recovery.afterRetry={state:await read(),raw:fixture.memory.get(motionKey),writes:motionWrites()};
      const operationStart=fixture.operations.length;o.recovery.activation=await tap(recover,'explicitly replace malformed setting with calm');await preference('calm');await expect(page.locator(calm)).toBeEnabled();await expect(page.locator(recover)).toHaveCount(0);await expect(page.locator(retry)).toHaveCount(0);await expect(panel(page).locator('h2')).toBeFocused();await reduced(true);await settleLayout();await still('recovered calm remains still');o.recovery.afterRecovery={state:await read(),operations:fixture.operations.slice(operationStart).filter(value=>value.key===motionKey).map(({operation,key,value})=>({operation,key,...(value===undefined?{}:{value})})),writes:motionWrites()};expect(o.recovery.afterRecovery.operations).toEqual([{operation:'set',key:motionKey,value:'calm'},{operation:'get',key:motionKey},{operation:'get',key:motionKey}]);expect(motionWrites()).toEqual([...writes,{operation:'set',key:motionKey,value:'calm'}]);expect(saved()).toEqual(originalPreferences);retained(await sample(page),failedScene);
    });
    await checked('only four explicit motion writes occur and all recorded controls use trusted touch',async()=>{
      o.eventSegments.push({label:'final page',events:await page.evaluate(()=>window.__calmMotion.events)});o.events=o.eventSegments.flatMap(segment=>segment.events);expect(o.events.filter(event=>event.type==='click').every(event=>event.trusted&&event.pointerType==='touch')).toBe(true);expect(o.events.filter(event=>event.type==='click'&&event.calm)).toHaveLength(3);expect(o.events.filter(event=>event.type==='click'&&event.surprise)).toHaveLength(2);expect(o.events.filter(event=>event.type==='click'&&event.retry)).toHaveLength(1);expect(o.events.filter(event=>event.type==='click'&&event.recover)).toHaveLength(1);expect(motionWrites()).toEqual(['calm','system','calm','calm'].map(value=>({operation:'set',key:motionKey,value})));expect(saved()).toEqual(originalPreferences);expect(o.swipes.length).toBeGreaterThan(0);o.final={preferences:saved(),motionWrites:motionWrites(),state:await read()};await fixture.verify();
    });
    result.pass=o.findings.length===0;result.observationsComplete=true;if(result.pass)Object.assign(result,{calmPreferenceTrustedTouch:true,calmPreferenceStopsActiveGesture:true,systemReducedMotionOverridesCalmOff:true,calmDisableDoesNotReplay:true,freshGestureAfterCalmDisableAnimates:true,calmDisablesWalking:true,calmPersistsAcrossResumeAndReload:true,calmMalformedReadRecoveryRequiresExplicitTouch:true,calmPreservesLegacyPreferencesAndCanonicalScene:true});expect(o.findings).toEqual([]);
  }finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}if(!o.events)o.eventSegments.push({label:'final cleanup',events:await page.evaluate(()=>window.__calmMotion?.events??[]).catch(()=>[])});await fixture.close();}
});

const DIAGNOSTIC_SCOPE='Synthetic font-only 200% CSS stress on Booky controls/help in the actual App; baseline computed font size and numeric line height doubled together. No Android, WebView, OS-font-scale equivalence, installed-device, or accessibility acceptance claim.';
for(const [language,portrait,landscape]of[['ru',{width:390,height:844},{width:568,height:320}],['en',{width:320,height:844},{width:640,height:360}]])test('Booky actual App font-only 200 percent stress '+language,async({},testInfo)=>{
  test.setTimeout(150000);const motionKey='probpera-booky-motion-v1',fixture=await open(testInfo,{allowedPreferenceKeys:[motionKey]}),{page,result}=fixture,o={language,portrait,landscape,scope:DIAGNOSTIC_SCOPE,phases:[],scales:[],actions:[],swipes:[],findings:[],setupErrors:[],eventSegments:[]};result.observations.fontStress=o;result.scenario='booky-font-only-200-stress-'+language;result.syntheticTextStress=true;result.nativeFontScaleEquivalent=false;result.scope=DIAGNOSTIC_SCOPE;let cdp;
  const keys={stop:'[data-booky-stop-gesture]',close:'[data-planet-mascot-collapse]',walk:'[data-booky-walk]',retry:'[data-booky-motion-retry]',recover:'[data-booky-motion-recover]',calm:'[data-booky-calm-motion]',quick:'[data-booky-open-gestures]',gallery:'[data-booky-gestures] > summary',toggle:'[data-planet-mascot-toggle]'},touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const legacy=()=>({memory:[...fixture.memory].filter(([key])=>key!==motionKey),writes:fixture.operations.filter(value=>value.operation!=='get'&&value.key!==motionKey).map(({operation,key,value})=>({operation,key,value}))});
  async function install(){await page.evaluate(keys=>{
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}),outside=(a,b)=>({left:Math.max(0,b.left-a.left),top:Math.max(0,b.top-a.top),right:Math.max(0,a.right-b.right),bottom:Math.max(0,a.bottom-b.bottom)}),overflow=value=>Object.values(value).some(n=>n>1),clipBox=e=>{const r=e.getBoundingClientRect();return{left:r.left+e.clientLeft,top:r.top+e.clientTop,right:r.left+e.clientLeft+e.clientWidth,bottom:r.top+e.clientTop+e.clientHeight};};
    const state=window.__fontStress={keys,registry:[],factor:1,events:[],phase:'setup'};
    const named=e=>Object.entries(keys).find(([,selector])=>e?.matches(selector))?.[0]??null;
    state.read=selector=>{const card=document.querySelector('[data-planet-mascot-panel]'),heading=card?.querySelector('header'),target=selector?document.querySelector(selector):null,r=box(target),c=box(card),h=box(heading),inCard=!!target&&!!card?.contains(target),inHeading=!!target&&!!heading?.contains(target),clip=inCard?{left:Math.max(0,c.left+2),right:Math.min(innerWidth,c.right-2),top:Math.max(0,c.top+2,inHeading?0:h?.bottom??0),bottom:Math.min(innerHeight,c.bottom-2)}:{left:0,top:0,right:innerWidth,bottom:innerHeight};
      const points=r?[{x:r.left+r.width/2,y:r.top+r.height/2},{x:r.left+r.width*.3,y:r.top+r.height/2},{x:r.left+r.width*.7,y:r.top+r.height/2}]:[],style=target?getComputedStyle(target):null;return{at:performance.now(),target:r,card:c,heading:h,clip,inCard,inHeading,visible:!!r&&r.width>0&&r.height>0&&style.display!=='none'&&style.visibility==='visible',inside:!!r&&r.width>0&&r.height>0&&r.left>=clip.left-1&&r.right<=clip.right+1&&r.top>=clip.top-1&&r.bottom<=clip.bottom+1,disabled:target?.disabled??false,points:points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,hit:!!hit&&(hit===target||target.contains(hit)),element:hit?.tagName,className:hit?.className??null};}),scrollTop:card?.scrollTop??null,scrollHeight:card?.scrollHeight??null,clientHeight:card?.clientHeight??null,documentScroll:{x:scrollX,y:scrollY,left:document.scrollingElement.scrollLeft,top:document.scrollingElement.scrollTop},font:style?{size:style.fontSize,lineHeight:style.lineHeight,borderRadius:style.borderRadius,clipPath:style.clipPath,overflowX:style.overflowX,overflowY:style.overflowY}:null,gesture:document.querySelector('[data-planet-mascot-pet]')?.getAttribute('data-planet-mascot-gesture'),animating:document.querySelector('[data-booky-canvas]')?.getAttribute('data-booky-animating'),runningFiniteAnimations:document.getAnimations().filter(animation=>(animation.pending||animation.playState==='running')&&Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>({playState:animation.playState,pending:animation.pending,endTime:animation.effect?.getComputedTiming().endTime}))};};
    state.restore=()=>{const before=state.read();for(const row of state.registry)if(row.element.isConnected){for(const [name,value,priority]of row.original){if(value)row.element.style.setProperty(name,value,priority);else row.element.style.removeProperty(name);}}state.registry=[];state.factor=1;return{before,after:state.read()};};
    state.scale=()=>{if(state.registry.length)throw Error('Restore before taking a fresh baseline');const root=document.querySelector('.planet-mascot-controls');if(!root)throw Error('No Booky subtree');const all=[root,...root.querySelectorAll('*')].filter(e=>e instanceof HTMLElement),before=state.read();
      const rows=all.map((element,index)=>{const style=getComputedStyle(element);return{element,index,original:['font-size','line-height'].map(name=>[name,element.style.getPropertyValue(name),element.style.getPropertyPriority(name)]),fontSize:parseFloat(style.fontSize),lineHeight:style.lineHeight,name:named(element),tag:element.tagName,className:element.className};});
      for(const row of rows){row.element.style.setProperty('font-size',String(row.fontSize*2)+'px','important');row.afterFontAssignment={inlineValue:row.element.style.getPropertyValue('font-size'),priority:row.element.style.getPropertyPriority('font-size'),computed:getComputedStyle(row.element).fontSize,cssText:row.element.style.cssText};if(row.lineHeight!=='normal'&&Number.isFinite(parseFloat(row.lineHeight)))row.element.style.setProperty('line-height',String(parseFloat(row.lineHeight)*2)+'px','important');}
      state.registry=rows;state.factor=2;return{factor:2,before,after:state.read(),snapshotBeforeAnyMutation:true,...state.auditScale()};};
    state.auditScale=()=>({at:performance.now(),fontLoadingStatus:document.fonts.status,animations:document.getAnimations().map(animation=>({targetTag:animation.effect?.target?.tagName??null,targetClass:animation.effect?.target?.className??null,playState:animation.playState,pending:animation.pending,currentTime:animation.currentTime,computedTiming:animation.effect?.getComputedTiming(),keyframes:animation.effect?.getKeyframes()})),elements:state.registry.map(row=>({index:row.index,name:row.name,tag:row.tag,className:row.className,connected:row.element.isConnected,baselineFontSize:row.fontSize,baselineLineHeight:row.lineHeight,afterFontAssignment:row.afterFontAssignment,inlineFontSize:row.element.style.getPropertyValue('font-size'),fontPriority:row.element.style.getPropertyPriority('font-size'),inlineLineHeight:row.element.style.getPropertyValue('line-height'),lineHeightPriority:row.element.style.getPropertyPriority('line-height'),inlineCssText:row.element.style.cssText,actualFontSize:parseFloat(getComputedStyle(row.element).fontSize),actualLineHeight:getComputedStyle(row.element).lineHeight,transitionProperty:getComputedStyle(row.element).transitionProperty,transitionDuration:getComputedStyle(row.element).transitionDuration,animationName:getComputedStyle(row.element).animationName}))});
    state.measure=label=>{const root=document.querySelector('.planet-mascot-controls'),texts=[],walker=root?document.createTreeWalker(root,NodeFilter.SHOW_TEXT):null;let node;while(walker&&(node=walker.nextNode())){if(!node.textContent.trim())continue;const parent=node.parentElement;if(!parent||parent.closest('.planet-mascot-controls__sr-only,[hidden]'))continue;const style=getComputedStyle(parent);if(style.display==='none'||style.visibility!=='visible')continue;const range=document.createRange();range.selectNodeContents(node);const glyphs=[...range.getClientRects()].map(rect).filter(r=>r.width>0&&r.height>0);if(!glyphs.length)continue;const control=parent.closest('button,summary'),controlRect=box(control),clips=[];for(let e=parent;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(/auto|scroll|hidden|clip/.test(s.overflowX+' '+s.overflowY)){const bounds=clipBox(e),isCard=e.hasAttribute('data-planet-mascot-panel');clips.push({tag:e.tagName,className:e.className,card:isCard,overflowX:s.overflowX,overflowY:s.overflowY,box:bounds,scrollLeft:e.scrollLeft,scrollTop:e.scrollTop,glyphOutside:glyphs.map(g=>outside(g,bounds)),scrollReachableVertical:/auto|scroll/.test(s.overflowY)});}}
        const intrinsic=controlRect?glyphs.map(g=>outside(g,controlRect)):[],nonScrollableClips=clips.filter(c=>c.glyphOutside.some(v=>(/hidden|clip/.test(c.overflowX)&&(v.left>1||v.right>1))||(/hidden|clip/.test(c.overflowY)&&(v.top>1||v.bottom>1))));texts.push({text:node.textContent.trim(),tag:parent.tagName,className:parent.className,decorative:!!parent.closest('[aria-hidden="true"]'),fontSize:style.fontSize,lineHeight:style.lineHeight,control:named(control),controlTag:control?.tagName??null,controlRect,controlScroll:control?{width:control.scrollWidth,height:control.scrollHeight,clientWidth:control.clientWidth,clientHeight:control.clientHeight}:null,glyphs,intrinsicOverflow:intrinsic,exceedsControlBorder:intrinsic.some(overflow),clips,nonScrollableClips,scrollHidden:glyphs.some(g=>clips.some(c=>c.card&&c.scrollReachableVertical&&(g.top<c.box.top-1||g.bottom>c.box.bottom+1)))});}
      const controls=Object.fromEntries(Object.entries(keys).map(([name,selector])=>[name,state.read(selector)]));return{label,factor:state.factor,at:performance.now(),viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,visualViewportScale:visualViewport?.scale},controls,texts,documentScroll:{x:scrollX,y:scrollY,left:document.scrollingElement.scrollLeft,top:document.scrollingElement.scrollTop},pageScrollWidth:document.documentElement.scrollWidth,limitations:['Text Range rectangles are inline layout boxes, not exact ink contours; 1 CSS pixel tolerance.','Ordinary vertical help scrolling is recorded separately from non-scroll clipping.','Arbitrary clip-path and paint containment are not evaluated.'],fontRegistryCount:state.registry.length};};
    for(const type of ['pointerdown','pointerup','pointercancel','click','touchmove'])document.addEventListener(type,event=>{const target=event.target instanceof Element?event.target:null,control=target?.closest('button,summary');state.events.push({phase:state.phase,at:performance.now(),type,trusted:event.isTrusted,pointerType:event.pointerType,control:named(control),targetTag:target?.tagName??null,targetClass:target?.className??null,controlTag:control?.tagName??null,controlText:control?.textContent?.trim()??null,targetRect:box(target),controlRect:box(control),cardRect:box(document.querySelector('[data-planet-mascot-panel]')),insidePanel:!!target?.closest('[data-planet-mascot-panel]')});},{capture:true,passive:true});
  },keys);}
  const read=selector=>page.evaluate(selector=>window.__fontStress.read(selector??null),selector),restore=()=>page.evaluate(()=>window.__fontStress.restore());
  async function settle(){let last,matches=0;await expect.poll(async()=>{const value=await read(),key=JSON.stringify({card:value.card,heading:value.heading,scroll:value.scrollTop});matches=key===last?matches+1:0;last=key;return matches;},{timeout:3000,intervals:[80]}).toBeGreaterThanOrEqual(3);await page.evaluate(()=>document.fonts.ready);}
  async function textMode(label,expanded){const value=await page.evaluate(()=>{const root=document.querySelector('.planet-mascot-controls'),actions=root?.querySelector('.planet-mascot-controls__heading-actions');return{expanded:root?.getAttribute('data-booky-expanded-text')==='true',headingActionsHeight:actions?.getBoundingClientRect().height??null};});(o.textModes??=[]).push({label,expectedExpanded:expanded,...value});expect(value.expanded,label+' expanded-text mode').toBe(expanded);}
  async function scale(label){await page.evaluate(()=>document.fonts.ready);const value=await page.evaluate(()=>window.__fontStress.scale()),observation={label,immediate:value,settled:null};o.scales.push(observation);expect(value.elements.length).toBeGreaterThan(5);await settle();observation.settled=await page.evaluate(()=>window.__fontStress.auditScale());expect(observation.settled.elements.every(row=>row.connected&&Math.abs(row.actualFontSize-row.baselineFontSize*2)<.01),'Every current Booky descendant must reach its recorded exact 200 percent font size after settling').toBe(true);await textMode(label+' enlarged',true);}
  async function expose(selector,label){const initial=await read(selector),usableHeight=initial.clip.bottom-initial.clip.top,scrollRange=Math.max(0,(initial.scrollHeight??0)-(initial.clientHeight??0)),estimatedProgress=Math.max(16,usableHeight-36),budget=Math.min(160,Math.max(24,Math.ceil(scrollRange/estimatedProgress)*2+8));(o.scrollBudgets??=[]).push({label,selector,scrollRange,usableHeight,estimatedProgress,budget,finiteCap:160,initial});for(let step=0;step<budget;step++){const before=await read(selector);if(!before.visible)return{reachable:false,reason:'not rendered in this state',state:before};if(before.inside&&before.points.every(point=>point.hit))return{reachable:true,state:before};if(!before.inCard||before.inHeading)return{reachable:false,reason:'critical fixed target is clipped or occluded',state:before};const available=before.clip.bottom-before.clip.top;if(available<44||before.target.height>available+1)return{reachable:false,reason:'target cannot fit below the sticky heading',state:before};const upward=before.target.bottom>before.clip.bottom,overflow=upward?before.target.bottom-before.clip.bottom:before.clip.top-before.target.top,distance=Math.min(available-20,Math.max(24,overflow+14)),x=(before.clip.left+before.clip.right)/2,startY=upward?before.clip.bottom-10:before.clip.top+10,endY=startY+(upward?-distance:distance),start=await page.evaluate(label=>{window.__fontStress.phase='scroll '+label;return window.__fontStress.events.length;},label);await touch('touchStart',[{x,y:startY,id:111}]);for(let n=1;n<=8;n++){await touch('touchMove',[{x,y:startY+(endY-startY)*n/8,id:111}]);await page.waitForTimeout(20);}await page.waitForTimeout(100);await touch('touchEnd',[]);await settle();const after=await read(selector),events=await page.evaluate(start=>window.__fontStress.events.slice(start),start);o.swipes.push({label,before,after,events});expect(after.documentScroll).toEqual(before.documentScroll);expect(events.filter(event=>event.type==='click')).toEqual([]);if(Math.abs(after.scrollTop-before.scrollTop)<1)return{reachable:false,reason:'trusted panel scrolling made no further progress',state:after};}return{reachable:false,reason:'bounded trusted scroll budget exhausted',state:await read(selector)};}
  async function tap(selector,label,{required=false,stress=false}={}){await settle();const exposed=await expose(selector,label),action={label,selector,stress,...exposed,events:[]};o.actions.push(action);if(!exposed.reachable){if(stress)o.findings.push({label,kind:'unreachable critical target',reason:exposed.reason,state:exposed.state});if(required)throw Error(label+': '+exposed.reason);return false;}let state,previous,matches=0;action.targetSettle=[];await expect.poll(async()=>{state=await read(selector);action.targetSettle.push(state);const key=JSON.stringify({target:state.target,card:state.card,heading:state.heading,scrollTop:state.scrollTop});matches=key===previous&&state.inside&&state.points.every(point=>point.hit)&&!state.runningFiniteAnimations.length?matches+1:0;previous=key;return matches;},{timeout:3500,intervals:[80]}).toBeGreaterThanOrEqual(3);action.state=state;expect(state.target.width).toBeGreaterThanOrEqual(44);expect(state.target.height).toBeGreaterThanOrEqual(44);const start=await page.evaluate(label=>{window.__fontStress.phase=label;return window.__fontStress.events.length;},label),x=state.target.left+state.target.width/2,y=state.target.top+state.target.height/2;await touch('touchStart',[{x,y,id:112}]);await touch('touchEnd',[]);await twoFrames(page);action.events=await page.evaluate(start=>window.__fontStress.events.slice(start),start);const intended=Object.entries(keys).find(([,value])=>value===selector)?.[0];expect(intended).toBeTruthy();for(const type of state.disabled?['pointerdown','pointerup']:['pointerdown','pointerup','click'])expect(action.events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&event.control===intended),label+' actual '+type+' reaches '+intended).toBe(true);return true;}
  async function inspect(label,{stress=false,imageName=null}={}){await settle();const value=await page.evaluate(label=>window.__fontStress.measure(label),label);o.phases.push(value);if(stress){for(const text of value.texts)if(text.control&&text.exceedsControlBorder)o.findings.push({label,kind:'text exceeds critical control border',control:text.control,text:text.text,decorative:text.decorative,glyphs:text.glyphs,controlRect:text.controlRect,overflow:text.intrinsicOverflow});for(const [name,control]of Object.entries(value.controls))if(control.visible&&['stop','close','walk','retry','recover'].includes(name)){if(control.target.width<44||control.target.height<44)o.findings.push({label,kind:'critical target below 44 CSS pixels',name,state:control});if(control.inHeading&&(!control.inside||!control.points.every(p=>p.hit)))o.findings.push({label,kind:'sticky heading control clipped or occluded',name,state:control});}const c=value.controls.close;if(c.card&&c.heading&&c.card.bottom-Math.max(c.card.top,c.heading.bottom)<44)o.findings.push({label,kind:'sticky heading leaves less than one 44px body target',card:c.card,heading:c.heading});}if(imageName){await capture(page,result,testInfo,imageName);Object.assign(result.screenshots.at(-1),{framing:stress?'actual-App synthetic font-only 200 percent stress':'actual-App baseline before synthetic font stress',syntheticTextStress:stress,factor:stress?2:1,nativeFontScaleEquivalent:false});}return value;}
  async function openGallery(label){if(!await panel(page).isVisible())await tap(keys.toggle,label+' help',{required:true});await expect(panel(page)).toBeVisible();await tap(keys.quick,label+' gallery',{required:true});await expect(page.locator('[data-booky-gestures]')).toHaveAttribute('open','');await settle();}
  async function closeForNext(label){if(await panel(page).isVisible()){await tap(keys.close,label,{required:true});await expect(panel(page)).toBeHidden();}}
  try{
    await page.setViewportSize(portrait);await page.emulateMedia({reducedMotion:'reduce'});await ready(page);if(language==='en'){await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({hasText:/^EN$/u}).tap();await ready(page);await expect(page.locator('html')).toHaveAttribute('lang','en');}await actual(page);await stablePose(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await install();cdp=await page.context().newCDPSession(page);await openGallery('portrait baseline');await expect.poll(()=>JSON.parse(fixture.memory.get(BOOKY)??'null')?.visible).toBe(true);await live(page);const prefs=legacy(),scene=await sample(page),model=await character(page);o.initial={preferences:prefs,scene,model:{id:model.model,renderer:model.rendererId,canvasRect:model.rect}};
    await textMode('portrait baseline',false);await inspect('portrait baseline',{imageName:'booky-font-stress-'+language+'-portrait-baseline.png'});await closeForNext('baseline closed walk measurement');await inspect('portrait closed companion baseline');await openGallery('portrait baseline restored');await scale('portrait help');await inspect('portrait help 200 percent',{stress:true,imageName:'booky-font-stress-'+language+'-portrait-help-200.png'});await tap(keys.stop,'portrait large-text Stop',{stress:true});const closed=await tap(keys.close,'portrait large-text Close',{stress:true});if(!closed){await restore();await settle();await closeForNext('baseline close after recording stress gap');await scale('portrait closed companion');}await inspect('portrait closed companion 200 percent',{stress:true,imageName:'booky-font-stress-'+language+'-portrait-walk-200.png'});await tap(keys.walk,'portrait large-text disabled walking target',{stress:true});expect(legacy()).toEqual(prefs);retained(await sample(page),scene);const sameModel=await character(page);expect(sameModel.model).toBe(model.model);expect(sameModel.rendererId).toBe(model.rendererId);expect([sameModel.rect.width,sameModel.rect.height]).toEqual([model.rect.width,model.rect.height]);
    await restore();await settle();await page.setViewportSize(landscape);await twoFrames(page);await stablePose(page);await openGallery('landscape baseline');await textMode('landscape baseline',false);await inspect('landscape baseline');const landscapeScene=await sample(page);await scale('short landscape help');await inspect('short landscape help 200 percent',{stress:true,imageName:'booky-font-stress-'+language+'-landscape-help-200.png'});await tap(keys.stop,'landscape large-text Stop',{stress:true});await tap(keys.close,'landscape large-text Close',{stress:true});expect(legacy()).toEqual(prefs);retained(await sample(page),landscapeScene);await restore();await settle();
    o.eventSegments.push({label:'normal preference lifetime',events:await page.evaluate(()=>window.__fontStress.events)});const malformed='synthetic-font-stress-malformed-motion';o.controlledPreferenceInput={key:motionKey,value:malformed,reason:'Expose real read-failure Retry and Recover controls without replacing product outcomes'};fixture.memory.set(motionKey,malformed);await page.setViewportSize(portrait);await page.reload();await ready(page);await stablePose(page);await actual(page);await page.evaluate(()=>window.__bookyLiveFixture.remember());await install();await openGallery('recovery baseline');await expect(page.locator(keys.retry)).toBeEnabled();await expect(page.locator(keys.recover)).toBeEnabled();const recoveryScene=await sample(page);await textMode('recovery baseline',false);await inspect('recovery baseline');await scale('read-failure recovery');await expose(keys.recover,'large-text recovery framing');await inspect('read-failure recovery 200 percent',{stress:true,imageName:'booky-font-stress-'+language+'-recovery-200.png'});await tap(keys.retry,'large-text Retry',{stress:true});await expect(page.locator(keys.retry)).toBeEnabled();await expect(page.locator(keys.recover)).toBeEnabled();await restore();await settle();await textMode('recovery after retry restored normal',false);await scale('recovery after retry');await inspect('recovery after retry 200 percent',{stress:true});await tap(keys.recover,'large-text Recover',{stress:true});await twoFrames(page);expect(legacy()).toEqual(prefs);retained(await sample(page),recoveryScene);o.motionWrites=fixture.operations.filter(value=>value.operation!=='get'&&value.key===motionKey).map(({operation,key,value})=>({operation,key,value}));expect(o.motionWrites.every(row=>row.operation==='set'&&row.value==='calm')).toBe(true);expect(o.motionWrites.length).toBeLessThanOrEqual(1);
    o.eventSegments.push({label:'recovery lifetime',events:await page.evaluate(()=>window.__fontStress.events)});o.events=o.eventSegments.flatMap(segment=>segment.events);expect(o.events.filter(event=>event.type==='click').every(event=>event.trusted&&event.pointerType==='touch')).toBe(true);await fixture.verify();result.observationsComplete=true;result.pass=o.findings.length===0;result.fontStressFindings=o.findings.length;expect(o.findings,'Synthetic font stress findings require review; this is not native accessibility acceptance').toEqual([]);o.checks=[{name:'all four font passes reach exactly 200 percent after settling',pass:true},{name:'portrait Stop, Close and disabled walking target receive trusted touch',pass:true},{name:'short-landscape Stop and Close receive trusted touch',pass:true},{name:'Retry and Recover remain reachable under enlarged text',pass:true},{name:'critical control text stays within measured button borders',pass:true},{name:'font stress preserves legacy preferences and canonical scene',pass:true},{name:'portrait scaling preserves the existing Booky model and canvas size',pass:true},{name:'expanded text mode returns to compact after font restoration',pass:true}];Object.assign(result,{fontStressExactTwoHundredPercent:true,fontStressCriticalControlsFitAndRespond:true,fontStressRecoveryReachableByTouch:true,fontStressCanonicalStateAndLegacyPreferencesPreserved:true,fontStressPortraitModelPreserved:true,fontStressNormalModeRestored:true});
  }catch(error){o.setupErrors.push({message:error.message,stack:error.stack??null});throw error;}finally{if(cdp){await touch('touchCancel',[]).catch(()=>undefined);await cdp.detach();}await fixture.close();}
});
