import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://library-window-depth.test';
const KEY = 'probpera-planet-composition-v1';
const LIBRARY='background.base.library', STUDY='background.base.writer-study';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'stand.base.book-stack', backgroundId: 'background.base.library' };
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
  const output = path.join(ROOT, '.tmp/library-window-depth-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';import{InstancedMesh,Matrix4,Mesh,Raycaster,Vector3}from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__libraryWindowDepth.sample?.()??null)},
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
    window.__libraryWindowDepth={scenes,remember:()=>{original=current()},
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
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__libraryWindowDepth.sample();},
    };
    const resourceLedger=new Map();let rememberedLibrary=null,anchor=null,anchorSearch=null;
    const watch=object=>{if(resourceLedger.has(object.uuid))return;
      const row={uuid:object.uuid,disposals:0};object.addEventListener('dispose',()=>row.disposals++);resourceLedger.set(object.uuid,row)};
    const inventory=group=>{const ids=new Set();group.traverse(object=>{
      if(!object.isMesh)return;watch(object.geometry);ids.add(object.geometry.uuid);
      if(object.isInstancedMesh){watch(object);ids.add(object.uuid)}
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        watch(material);ids.add(material.uuid);for(const value of Object.values(material))if(value?.isTexture){watch(value);ids.add(value.uuid)}
      }});return [...ids].sort()};
    const instanceWorld=(mesh,index)=>{const result=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){
      const local=new Matrix4();mesh.getMatrixAt(index,local);result.multiply(local)}return result};
    const libraryOf=root=>root?.scene.getObjectByName('included-globe-background:background.base.library');
    const sampleBeforeDepth=window.__libraryWindowDepth.sample;
    const rememberBeforeDepth=window.__libraryWindowDepth.remember;
    window.__libraryWindowDepth.remember=()=>{rememberBeforeDepth();const root=current(),group=libraryOf(root);
      if(!group)throw Error('Library is not rendered');group.updateWorldMatrix(true,true);
      rememberedLibrary={group,resourceIds:inventory(group)};};
    const screenPoint=(root,point)=>{const p=point.clone().project(root.camera),rect=root.canvas.getBoundingClientRect();
      const screen={x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
      return{ndc:p.toArray(),screen,inViewport:Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z>-1&&p.z<1,
        unobscuredDOM:document.elementFromPoint(screen.x,screen.y)===root.canvas}};
    const paneIntersection=(root,world,inverse)=>{
      const eye=root.camera.position.clone().applyMatrix4(inverse),end=world.clone().applyMatrix4(inverse);
      const distance=end.z-eye.z;if(eye.z>=0||end.z<=0||distance<1e-8)return null;
      const point=eye.lerp(end,-eye.z/distance);
      const inside=Math.abs(point.x)<.46&&Math.abs(point.y)<.46;
      // Keep the measured sightline in real glass, clear of existing mullions.
      const clearPane=inside&&Math.abs(point.x)>.055&&[-.5,-.25,0,.25,.5].every(y=>Math.abs(point.y-y)>.033);
      return{point,inside,clearPane};
    };
    const geometryOccludes=(root,world,far)=>{
      const ray=new Raycaster(root.camera.position,world.clone().sub(root.camera.position).normalize(),0,far);
      let blocked=false;
      root.scene.traverseVisible(object=>{
        if(blocked||!object.isMesh||!object.visible)return;
        // The branch is the measured exterior target. Trace all intervening
        // architecture, including the wall BEHIND the transparent glazing.
        if(object.name.startsWith('library-exterior-tree-'))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        if(materials.every(material=>material.transparent))return;
        const hits=[];
        // The decorative product meshes keep raycast disabled. Direct prototype
        // calls inspect their actual buffers here without changing that policy.
        (object.isInstancedMesh?InstancedMesh.prototype:Mesh.prototype).raycast.call(object,ray,hits);
        if(hits.length)blocked=true;
      });return blocked;
    };
    const observeAnchor=root=>{
      if(!anchor)return null;
      const treeWorld=instanceWorld(anchor.tree,anchor.instance);
      const world=new Vector3().fromBufferAttribute(anchor.tree.geometry.getAttribute('position'),anchor.vertex).applyMatrix4(treeWorld);
      const paneWorld=instanceWorld(anchor.glass,anchor.pane),hit=paneIntersection(root,world,paneWorld.clone().invert());
      const fixedWindowPoint=anchor.fixedPanePoint.clone().applyMatrix4(paneWorld);
      const projected=screenPoint(root,world),windowProjected=screenPoint(root,fixedWindowPoint);
      return{treeMesh:anchor.tree.name,treeGeometry:anchor.tree.geometry.uuid,treeInstance:anchor.instance,treeVertex:anchor.vertex,
        glazingGeometry:anchor.glass.geometry.uuid,glazingInstance:anchor.pane,
        treeMatrix:treeWorld.toArray(),glazingMatrix:paneWorld.toArray(),world:world.toArray(),fixedWindowWorld:fixedWindowPoint.toArray(),
        treeDepth:root.camera.position.distanceTo(world),windowDepth:root.camera.position.distanceTo(fixedWindowPoint),
        windowLocalIntersection:hit?.point.toArray()??null,clearPane:!!hit?.clearPane,projected,windowProjected,
        relativeProjection:projected.ndc.slice(0,2).map((value,index)=>value-windowProjected.ndc[index])};
    };
    window.__libraryWindowDepth.chooseAnchor=()=>{
      const root=current(),group=libraryOf(root);if(!group)return null;root.scene.updateMatrixWorld(true);
      const glass=group.getObjectByName('library-window-glazing');if(!glass?.isInstancedMesh)throw Error('Missing actual library glazing');
      const panes=Array.from({length:glass.count},(_,pane)=>({pane,world:instanceWorld(glass,pane)}));
      for(const pane of panes)pane.inverse=pane.world.clone().invert();
      const candidates=[];
      group.traverse(tree=>{
        if(!tree.isInstancedMesh||!tree.name.startsWith('library-exterior-tree-'))return;
        const positions=tree.geometry.getAttribute('position'),step=Math.max(1,Math.floor(positions.count/144));
        for(let instance=0;instance<tree.count;instance++){
          const transform=instanceWorld(tree,instance);
          for(let vertex=0;vertex<positions.count;vertex+=step){
            const world=new Vector3().fromBufferAttribute(positions,vertex).applyMatrix4(transform),projected=screenPoint(root,world);
            if(!projected.inViewport||!projected.unobscuredDOM)continue;
            for(const pane of panes){const hit=paneIntersection(root,world,pane.inverse);
              if(!hit?.clearPane||Math.abs(hit.point.x)>.35||Math.abs(hit.point.y)>.4)continue;
              const fixed=hit.point.clone().applyMatrix4(pane.world),windowDepth=root.camera.position.distanceTo(fixed);
              if(root.camera.position.distanceTo(world)-windowDepth<2)continue;
              candidates.push({tree,instance,vertex,glass,pane:pane.pane,fixedPanePoint:hit.point.clone(),world,windowDepth,
                score:Math.abs(Math.abs(hit.point.x)-.24)+Math.abs(Math.abs(hit.point.y)-.13)+Math.abs(projected.ndc[0])*.15});
            }
          }
        }
      });
      candidates.sort((a,b)=>a.score-b.score);
      anchorSearch={candidateCount:candidates.length,checked:0,blocked:0};
      for(const candidate of candidates.slice(0,24)){
        anchorSearch.checked++;
        if(geometryOccludes(root,candidate.world,root.camera.position.distanceTo(candidate.world)-.025)){anchorSearch.blocked++;continue;}
        anchor=candidate;return observeAnchor(root);
      }
      return null;
    };
    window.__libraryWindowDepth.anchorClear=()=>{
      const root=current(),observed=observeAnchor(root);if(!observed?.clearPane||!observed.projected.inViewport||!observed.projected.unobscuredDOM)return false;
      const world=new Vector3(...observed.world);
      return !geometryOccludes(root,world,root.camera.position.distanceTo(world)-.025);
    };
    window.__libraryWindowDepth.sample=()=>{
      const base=sampleBeforeDepth(),root=current();if(!base||!root)return base;
      const group=libraryOf(root),held=rememberedLibrary?.group,inspected=group??held;
      const glass=inspected?.getObjectByName('library-window-glazing'),pages=inspected?.getObjectByName('library-book-page-blocks');
      const exterior=[];inspected?.traverse(object=>{if(object.isMesh&&object.name.startsWith('library-exterior-'))
        exterior.push({name:object.name,uuid:object.uuid,geometry:object.geometry.uuid,instances:object.isInstancedMesh?object.count:1,
          triangles:(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object.isInstancedMesh?object.count:1)})});
      return{...base,library:{uuid:inspected?.uuid??null,attached:!!group,retained:!!held&&(!group||group===held),
        glazingCount:glass?.count??0,bookCount:pages?.count??0,oldOpaqueWindowBackings:!!inspected?.getObjectByName('library-windows'),exterior,
        disposals:rememberedLibrary?rememberedLibrary.resourceIds.map(id=>resourceLedger.get(id)).filter(row=>row.disposals>0):[]},anchor:observeAnchor(root),anchorSearch};
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__libraryWindowDepthError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'library-window-depth', assetNames: 'assets/[name]-[hash]',
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
  const sourcePaths = [...new Set([...required, 'tests/pwa/library-window-depth.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-library-window-depth-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS plugins and preferences backed by a Node map'], sourceInputs,
    cameraAuthority: 'Actual product zoom-out buttons and keyboard orbit; no fixture camera assignments.',
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s13-library-depth'));
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, 'win-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const initialRecord = JSON.stringify({ schemaVersion: 1, commitId: 'library-window-depth-fixture:1', selection: BASE });
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/library-window-depth.css"></head><body><div id="root"></div><script src="/fixture/library-window-depth.js"></script></body></html>' }); return;
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
        result.lastScene = await sample(page);
        result.customizationWrites = operations.filter(value => value.operation !== 'get' && CUSTOMIZATION_KEYS.has(value.key));
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath('library-window-depth.json'); await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('library-window-depth-source-evidence', { path: filename, contentType: 'application/json' }); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

const sample = page => page.evaluate(() => window.__libraryWindowDepth.sample());
const globe = page => page.locator('#atlas .literary-globe');
const panel = page => page.locator('[data-planet-stand-panel]');
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(globe(page)).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__libraryWindowDepthError ?? null)).toBeNull();
}
async function actual(page, standId, background = LIBRARY) {
  let observed;
  const expected = { ...selection(standId), backgroundId: background };
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(expected);
  observed = await page.evaluate(() => window.__libraryWindowDepth.renderSample());
  expect(observed.selection).toEqual(expected); expect(observed.uploaded).toBe(true);
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
async function capture(fixture, testInfo, filename) {
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename) });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing: 'actual product zoom-out and keyboard orbit; original persistent camera' });
}

async function orbit(page, key) {
  await globe(page).focus(); await globe(page).press(key);
  await expect(globe(page)).toHaveAttribute('data-globe-camera-phase', 'idle'); await stablePose(page);
}
async function frameRoom(page) {
  const zoomOut = page.locator('[data-globe-control="zoom-out"]');
  for (let count = 0; count < 8 && !await zoomOut.isDisabled(); count++) {
    await zoomOut.click(); await stablePose(page);
  }
  await expect(zoomOut).toBeDisabled();
  // Keep the selected writer while looking level into the reading hall. These
  // are real product keyboard requests, not test assignments to a camera.
  for (let count = 0; count < 9; count++) {
    const { position, target } = (await sample(page)).pose;
    const offset = position.map((value, axis) => value - target[axis]);
    const elevation = Math.atan2(offset[1], Math.hypot(offset[0], offset[2]));
    if (elevation >= -.07 && elevation <= .13) return;
    await orbit(page, elevation > .13 ? 'ArrowDown' : 'ArrowUp');
  }
  throw Error('Could not frame the library through bounded product orbit controls');
}
function assertLibrary(observed) {
  expect(observed.library.glazingCount).toBe(32); expect(observed.library.bookCount).toBe(984);
  expect(observed.library.oldOpaqueWindowBackings).toBe(false);
  const trees = observed.library.exterior.filter(item => item.name.startsWith('library-exterior-tree-'));
  expect(trees).toHaveLength(3); expect(trees.reduce((sum, item) => sum + item.instances, 0)).toBe(16);
  for (const tree of trees) expect(tree.triangles).toBeGreaterThan(20);
  expect(observed.library.exterior.some(item => item.name === 'library-exterior-sky')).toBe(true);
  expect(observed.library.exterior.some(item => item.name === 'library-exterior-ground')).toBe(true);
  expect(observed.library.retained).toBe(true); expect(observed.library.disposals).toEqual([]);
}
async function anchorReady(page) {
  for (let count = 0; count < 9; count++) {
    const anchor = await page.evaluate(() => window.__libraryWindowDepth.chooseAnchor());
    if (anchor) return anchor;
    if (count < 8) await orbit(page, 'ArrowRight');
  }
  throw Error('No actual exterior branch is visible through a clear window pane');
}
async function backgroundPanel(page) {
  const toggle = page.locator('[data-planet-stand-toggle]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const background = page.locator('[data-planet-background-panel]');
  if (!await background.isVisible()) await page.locator('[data-planet-customization-tab="background"]').click();
  await expect(background).toBeVisible(); return background;
}

test('library windows expose exterior geometry and retain the same room through preview cancellation', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  try {
    await actual(page, BASE.standId); await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await frameRoom(page); await page.evaluate(() => window.__libraryWindowDepth.remember());
    const baseline = await actual(page, BASE.standId); assertLibrary(baseline);
    expect(baseline.quality).toBe('high'); expect(baseline.url).toContain('country=russia');
    expect(baseline.url).toContain('writer=dostoevsky'); expect(fixture.writes()).toEqual([]);
    result.observations.baseline = baseline;

    await anchorReady(page);
    const first = await actual(page, BASE.standId); retained(first, baseline); assertLibrary(first);
    expect(first.anchor.clearPane).toBe(true); expect(first.anchor.projected.unobscuredDOM).toBe(true);
    expect(first.anchor.treeDepth - first.anchor.windowDepth).toBeGreaterThan(2);
    expect(await page.evaluate(() => window.__libraryWindowDepth.anchorClear())).toBe(true);
    result.observations.firstView = first;
    await capture(fixture, testInfo, 'library-window-depth-first-ru-1440.png');

    await page.locator('.atlas-immersive-chrome .interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle');
    await orbit(page, 'ArrowRight');
    // The same branch must remain visible in the same pane. If its right-hand
    // edge is occluded, use the other real ten-degree view without changing it.
    if (!await page.evaluate(() => window.__libraryWindowDepth.anchorClear())) {
      await orbit(page, 'ArrowLeft'); await orbit(page, 'ArrowLeft');
    }
    expect(await page.evaluate(() => window.__libraryWindowDepth.anchorClear())).toBe(true);
    const second = await actual(page, BASE.standId); retained(second, baseline); assertLibrary(second);
    const anchorKeys = ['treeMesh', 'treeGeometry', 'treeInstance', 'treeVertex', 'glazingGeometry', 'glazingInstance',
      'treeMatrix', 'glazingMatrix', 'world', 'fixedWindowWorld'];
    for (const key of anchorKeys) expect(second.anchor[key], key).toEqual(first.anchor[key]);
    expect(second.pose.position).not.toEqual(first.pose.position);
    const displacement = Math.hypot(...second.anchor.relativeProjection.map((value, axis) => value - first.anchor.relativeProjection[axis]));
    const paneDisplacement = Math.hypot(...second.anchor.windowLocalIntersection.slice(0, 2)
      .map((value, axis) => value - first.anchor.windowLocalIntersection[axis]));
    expect(displacement).toBeGreaterThan(.002); expect(paneDisplacement).toBeGreaterThan(.01);
    result.observations.orbitedView = second;
    result.parallax = { relativeNdcDisplacement: displacement, paneLocalDisplacement: paneDisplacement };
    await capture(fixture, testInfo, 'library-window-depth-orbit-en-1440.png');

    const panel = await backgroundPanel(page);
    await panel.locator('[data-planet-background-select]').selectOption(STUDY);
    await expect(panel).toHaveAttribute('data-planet-background-phase', 'preview');
    await expect(panel.locator('[data-planet-background-apply]')).toBeEnabled();
    const preview = await actual(page, BASE.standId, STUDY); assertLibrary(preview);
    expect(preview.sameScene).toBe(true); expect(preview.library.attached).toBe(false);
    expect(preview.texture).toBe(baseline.texture); expect(preview.stand.uuid).toBe(baseline.stand.uuid);
    expect(preview.pose).toEqual(second.pose); expect(preview.url).toBe(baseline.url);
    result.observations.backgroundPreview = preview;
    await panel.locator('[data-planet-background-cancel]').click();
    await expect(globe(page)).toHaveAttribute('data-planet-composition-phase', 'idle'); await stablePose(page);
    const returned = await actual(page, BASE.standId); retained(returned, baseline); assertLibrary(returned);
    expect(returned.library.uuid).toBe(baseline.library.uuid); expect(returned.library.attached).toBe(true);
    expect(returned.pose).toEqual(second.pose); expect(returned.library.exterior).toEqual(baseline.library.exterior);
    expect(fixture.writes()).toEqual([]); expect(fixture.memory.get(KEY)).toBe(fixture.initialRecord);
    await expect(page.locator('canvas')).toHaveCount(1); result.observations.returned = returned;
    Object.assign(result, { productCameraControlsOnly: true, actualExteriorParallax: true, retainedLibraryResources: true,
      sameSceneAndSelection: true, previewDoesNotPersist: true }); fixture.verify();
  } finally { await fixture.close(); }
});
