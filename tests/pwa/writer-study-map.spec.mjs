import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Actual App, native source entry, CSS, country data, textures and R3F scene.
// Native OS plugins are controlled ports. Preview, renderer acknowledgements,
// controls, persistence controller and canonical scene are actual source.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://writer-study-map.test";
const KEY = "probpera-planet-composition-v1", STAND_KEY = "probpera-planet-stand-v1";
const EDITION_KEY = "probpera.globe-edition.v2", BACKGROUND_KEY = "probpera-planet-background-v1";
const WOOD = "stand.base.wood";
const STUDY = "background.base.writer-study", TOLSTOY = "stand.base.portrait-tolstoy";
const LIBRARY = "background.base.library";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/writer-study-map-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
    import{Box3,Matrix4,Ray,Texture,Vector3}from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={
      core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),set:async({key,value})=>{
        await window.__osPreference('set',key,value,window.__compositionSample?.()??null)},remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},
      appLauncher:{openUrl:async()=>({completed:false})}
    };
    window.__editionScene={scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,frameloop:s.frameloop}}),
      back:()=>{const current=handles.filter(handle=>!handle.removed&&handle.event==='backButton');for(const handle of current)handle.listener({canGoBack:false});return current.length},
      active:value=>{active=value;const current=handles.filter(handle=>!handle.removed&&handle.event==='appStateChange');for(const handle of current)handle.listener({isActive:value});return current.length}};
    const resourceLedger=new Map(), anchorSets=new Map();
    const fingerprintFloats=array=>{let hash=2166136261;for(const value of array??[])hash=Math.imul(hash^(Math.round(value*1e5)>>>0),16777619)>>>0;return hash};
    const rounded=array=>array.map(value=>Number(value.toFixed(5)));
    const watch=(object,kind)=>{
      if(resourceLedger.has(object.uuid))return;
      const row={kind,disposals:0};object.addEventListener('dispose',()=>{row.disposals++});resourceLedger.set(object.uuid,row);
    };
    window.__resourceLedger=()=>[...resourceLedger].map(([uuid,row])=>({uuid,...row}));
    const inventory=group=>{
      const geometries=new Set(),materials=new Set(),textures=new Set(),instances=new Set();let meshes=0,triangles=0;
      group.traverse(mesh=>{
        if(!mesh.isMesh)return;meshes++;
        watch(mesh.geometry,'geometry');geometries.add(mesh.geometry.uuid);
        const count=mesh.isInstancedMesh?mesh.count:1;
        triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*count;
        if(mesh.isInstancedMesh){watch(mesh,'instance');instances.add(mesh.uuid)}
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          watch(material,'material');materials.add(material.uuid);
          for(const value of Object.values(material))if(value?.isTexture){watch(value,'texture');textures.add(value.uuid)}
        }
      });
      return{uuid:group.uuid,matrix:rounded(group.matrixWorld.toArray()),meshes,triangles,
        geometries:[...geometries].sort(),materials:[...materials].sort(),textures:[...textures].sort(),instances:[...instances].sort()};
    };
    const transform=(mesh,index)=>{
      const matrix=mesh.matrixWorld.clone();
      if(mesh.isInstancedMesh){const instance=new Matrix4();mesh.getMatrixAt(index,instance);matrix.multiply(instance)}return matrix;
    };
    const location=anchor=>new Vector3().fromBufferAttribute(anchor.mesh.geometry.getAttribute('position'),anchor.vertex).applyMatrix4(transform(anchor.mesh,anchor.instance));
    const landmark=(group,name)=>{
      const mesh=group.getObjectByName(name);if(!mesh?.isMesh)throw Error('Missing actual study mesh: '+name);
      const bounds=new Box3().setFromObject(mesh);
      return{name,instances:mesh.isInstancedMesh?mesh.count:1,matrix:rounded(mesh.matrixWorld.toArray()),
        bounds:{min:rounded(bounds.min.toArray()),max:rounded(bounds.max.toArray())},
        placements:mesh.isInstancedMesh?fingerprintFloats(mesh.instanceMatrix.array):null,
        colors:mesh.instanceColor?fingerprintFloats(mesh.instanceColor.array):null};
    };
    const studyView=(group,camera)=>{
      const layers=['foreground','midground','background'].map(suffix=>{
        const name='writer-study-'+suffix,layer=group.getObjectByName(name),key=group.uuid+':'+name;
        if(!layer)throw Error('Missing actual study layer: '+name);
        let meshes=0,instances=0;const candidates=[];
        layer.traverse(mesh=>{
          if(!mesh.isMesh)return;meshes++;const count=mesh.isInstancedMesh?mesh.count:1;instances+=count;
          if(anchorSets.has(key))return;
          const positions=mesh.geometry.getAttribute('position');
          for(const instance of new Set([0,Math.floor(count/2),count-1]))for(const vertex of new Set([0,Math.floor(positions.count/2),positions.count-1])){
            const anchor={mesh,instance,vertex,key:mesh.uuid+':'+instance+':'+vertex};
            const projected=location(anchor).project(camera);
            const visible=Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z>-1&&projected.z<1;
            candidates.push({anchor,score:(visible?0:100)+Math.abs(projected.x)+Math.abs(projected.y)});
          }
        });
        if(!anchorSets.has(key)){candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)throw Error('Study layer has no geometry');anchorSets.set(key,candidates[0].anchor)}
        const anchor=anchorSets.get(key),world=location(anchor),projected=world.clone().project(camera);
        return{name,meshes,instances,anchor:{key:anchor.key,world:world.toArray(),projected:projected.toArray()}};
      });
      return{...inventory(group),layers,landmarks:['writer-study-desk-top','writer-study-cabinet-cases',
        'writer-study-book-page-blocks','writer-study-window-glazing','writer-study-lamp-shade'].map(name=>landmark(group,name))};
    };
    window.__compositionSample=()=>{
      const root=window.__editionScene.scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
      if(!root)return null;
      root.scene.updateMatrixWorld(true);
      const stands=[],backgrounds=[],surfaces=[];
      root.scene.traverse(object=>{
        if(object.name.startsWith('included-globe-stand:'))stands.push({id:object.userData.standId,...inventory(object)});
        if(object.name.startsWith('included-globe-background:'))backgrounds.push({id:object.userData.backgroundId,quality:object.userData.qualityTier,...inventory(object),study:object.userData.backgroundId==='background.base.writer-study'?studyView(object,root.camera):null});
        if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1&&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surfaces.push(object);
      });
      const pages=root.scene.getObjectByName('library-book-page-blocks');
      const libraryDensity=pages?.isInstancedMesh?{books:pages.count,
        placements:fingerprintFloats(pages.instanceMatrix.array),colors:fingerprintFloats(pages.instanceColor?.array)}:null;
      const surface=surfaces[0],map=surface?.material.map;
      const thumb=document.createElement('canvas');thumb.width=128;thumb.height=64;
      const context=thumb.getContext('2d');let fingerprint=2166136261;
      if(map&&context){context.drawImage(map.image,0,0,thumb.width,thumb.height);
        for(const value of context.getImageData(0,0,thumb.width,thumb.height).data)fingerprint=Math.imul(fingerprint^value,16777619)>>>0;}
      const gpu=map?root.renderer.properties.get(map):null;
      const original=window.__compositionOriginal;
      return {editionId:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-edition'),
        standId:stands[0]?.id??'canonical',backgroundId:backgrounds[0]?.id??'background.base.site-starfield',
        standCount:stands.length,backgroundCount:backgrounds.length,surfaceCount:surfaces.length,libraryDensity,
        standResources:stands[0]??null,backgroundResources:backgrounds[0]??null,study:backgrounds[0]?.study??null,quality:backgrounds[0]?.quality??null,drawCalls:root.renderer.info.render.calls,triangles:root.renderer.info.render.triangles,
        frame:root.renderer.info.render.frame,gpuMemory:{...root.renderer.info.memory},contextLost:root.renderer.getContext().isContextLost(),
        sameScene:!original||(root.canvas===original.canvas&&root.renderer===original.renderer&&root.camera===original.camera&&root.scene===original.scene),
        geometry:surface?.geometry.uuid,texture:map?.uuid,fingerprint,
        mapVersion:map?.version,uploadedVersion:gpu?.__version??null,gpuAllocated:!!gpu?.__webglTexture,
        pose:{position:root.camera.position.toArray().map(value=>Number(value.toFixed(5))),quaternion:root.camera.quaternion.toArray().map(value=>Number(value.toFixed(5))),zoom:root.camera.zoom}};
    };
    // Test-only observers delegate unchanged behavior. No scene/camera/texture
    // mutation is introduced to make the product pass these observations.
    const atlasClones=[],originalClone=Texture.prototype.clone;
    Texture.prototype.clone=function(...args){const clone=Reflect.apply(originalClone,this,args);
      atlasClones.push({source:this.uuid,clone:clone.uuid});return clone};
    const currentMap=()=>{
      const current=window.__editionScene.scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
      if(!current)return null;current.scene.updateMatrixWorld(true);
      let surface;current.scene.traverse(object=>{
        if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1&&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surface=object;
      });
      const study=current.scene.getObjectByName('included-globe-background:background.base.writer-study');
      return{...current,surface,study,sheet:study?.getObjectByName('writer-study-wall-map'),frame:study?.getObjectByName('writer-study-wall-map-frame')};
    };
    window.__rememberStudyMap=()=>{
      const current=currentMap();if(!current?.sheet?.isMesh||!current.frame?.isMesh)throw Error('Actual wall map is not rendered');
      const map=current.surface.material.map;watch(map,'atlas');const resources=inventory(current.study);
      window.__mapOriginal={...current,map,image:map.image,resources};
      window.__compositionOriginal=current;
    };
    const compositionSample=window.__compositionSample;
    window.__compositionSample=()=>{
      const base=compositionSample(),current=currentMap();if(!base||!current)return base;
      const original=window.__mapOriginal,map=current.surface?.material.map;
      const sheet=current.sheet??original?.sheet,frame=current.frame??original?.frame;
      const bounds=object=>{const b=new Box3().setFromObject(object);return{min:b.min.toArray(),max:b.max.toArray()}};
      const box=sheet?new Box3().setFromObject(sheet):null,center=box?.getCenter(new Vector3());
      const direction=center?.clone().sub(current.camera.position).normalize();
      const sphereCenter=current.surface?.getWorldPosition(new Vector3());
      const clearance=direction&&sphereCenter?new Ray(current.camera.position,direction).distanceToPoint(sphereCenter):null;
      const corners=box?[new Vector3(box.min.x,box.min.y,box.min.z),new Vector3(box.min.x,box.max.y,box.min.z),
        new Vector3(box.max.x,box.min.y,box.max.z),new Vector3(box.max.x,box.max.y,box.max.z)]
        .map(point=>point.project(current.camera).toArray()):[];
      const ids=original?new Set(['geometries','materials','textures','instances'].flatMap(key=>original.resources[key])):new Set();
      ids.delete(original?.map.uuid);
      return{...base,canvasCount:document.querySelectorAll('#atlas canvas').length,visibleStudy:!!current.study,
        identities:original?{sameCanvas:current.canvas===original.canvas,sameRenderer:current.renderer===original.renderer,
          sameCamera:current.camera===original.camera,sameScene:current.scene===original.scene,sameAtlasTexture:map===original.map,
          sameAtlasCanvas:map?.image===original.image,retainedStudy:!current.study||current.study===original.study,
          sameSheet:!current.sheet||current.sheet===original.sheet,sameMaterial:!current.sheet||current.sheet.material===original.sheet.material}:null,
        wallMap:sheet?{uuid:sheet.uuid,geometry:sheet.geometry.uuid,material:sheet.material.uuid,mapTexture:sheet.material.map?.uuid??null,
          sameTexture:sheet.material.map===map,retainedSameTexture:original?original.sheet.material.map===map:null,bounds:bounds(sheet),
          indexCount:sheet.geometry.index?.count??sheet.geometry.getAttribute('position').count,
          frame:frame?{uuid:frame.uuid,bounds:bounds(frame),indexCount:frame.geometry.index?.count??frame.geometry.getAttribute('position').count}:null,
          projectedCenter:center?.clone().project(current.camera).toArray(),projectedCorners:corners,sightlineGlobeClearance:clearance}:null,
        atlasCloneCalls:original?atlasClones.filter(row=>row.source===original.map.uuid):[],
        atlasDisposals:original?resourceLedger.get(original.map.uuid)?.disposals:0,
        roomDisposals:[...ids].map(uuid=>({uuid,...resourceLedger.get(uuid)})).filter(row=>row.disposals>0),observedRoomResourceCount:ids.size};
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__editionBootstrapError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "composition", assetNames: "assets/[name]-[hash]",
    publicPath: "/fixture/", format: "iife", platform: "browser", target: "es2020", jsx: "automatic", logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false, PROD: true,
      VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "", VITE_TURNSTILE_SITE_KEY: "" }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: "false",
      __LITERARY_PLANET_LICENSE_AUTHORITY__: "null", __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { ".css": "css", ".png": "file", ".webp": "file", ".avif": "file", ".jpg": "file", ".jpeg": "file", ".svg": "file", ".woff": "file", ".woff2": "file" },
    plugins: [{ name: "canonical-vite-resources", setup(builder) {
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await fs.readFile(args.path, "utf8"), attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt);
          return `({"./BookShelfSceneCanvas.tsx": () => import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module => module.default)})`;
        });
        if (attempts.join(",") !== "primary,retry" || contents.includes("import.meta.glob")) throw Error("Review changed canonical Vite glob imports");
        return { contents, loader: "tsx", resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split("?"); return { path: path.resolve(args.resolveDir, filename), suffix: "?" + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === "url-token" ? { path: args.path, external: true } : undefined);
      builder.onResolve({ filter: /\.geojson\?url$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "canonical-geojson-url" }));
      builder.onLoad({ filter: /.*/, namespace: "canonical-geojson-url" }, async args => ({ contents: await fs.readFile(args.path), loader: "file" }));
    } }],
  });
  const inputs = Object.keys(built.metafile.inputs).map(value => value.replaceAll("\\", "/"));
  for (const module of ["src/App.tsx", "src/host/mountHostApp.tsx", "src/components/LiteraryGlobe.tsx",
    "src/components/GlobeCameraRig.tsx", "src/components/globeAtlas.ts", "src/components/GlobeIncludedStand.tsx",
    "src/components/globeStandGeometry.ts", "src/components/globeCeramicPortraitStandGeometry.ts",
    "src/components/globeWriterStudyGeometry.ts", "src/components/globeBackgroundGeometry.ts",
    "src/components/globeCraftMaterials.ts", "src/planet/globeBackgrounds.ts", "src/host/PlanetStandControls.tsx", "src/host/planetComposition.ts", "src/planet/globeComposition.ts", "src/components/GlobeIncludedBackground.tsx", "src/components/globeLibraryGeometry.ts", "src/components/globeLibraryBookGeometry.ts"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  const sourcePaths = ['src/components/LiteraryGlobe.tsx', 'src/components/GlobeIncludedBackground.tsx',
    'src/components/globeWriterStudyGeometry.ts', 'src/components/globeBackgroundGeometry.ts',
    'src/components/globeLibraryGeometry.ts', 'src/components/globeAtlas.ts', 'src/host/planetComposition.ts'];
  const sourceInputs = await Promise.all(sourcePaths.map(async value => ({ path: value,
    sha256: digest(await fs.readFile(path.join(root, value))) })));
  sourceEvidence = { kind: "canonical-app-writer-study-live-atlas-map-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true, sourceInputs,
    controlledPorts: ["native OS plugins and local preferences"],
    observation: "Actual wall map borrows the globe atlas through locale, committed edition change and background preview cancellation",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

const legacyKeys = [EDITION_KEY, "probpera.globe-style.v1", STAND_KEY, BACKGROUND_KEY];

async function open(testInfo, { newValue } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-study-map"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "wm-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"],
    [EDITION_KEY, "modern"], [STAND_KEY, WOOD], [BACKGROUND_KEY, LIBRARY]]);
  if (newValue !== undefined) memory.set(KEY, newValue);
  const operations = [], errors = [], externalRequests = [], missingResources = [], localAssetRequests = [];
  const result = { ...sourceEvidence, pass: false, observations: {}, screenshots: [], scope: { actualApp: true, actualCanvas: true, cameraWrites: false, cameraControls: "user keyboard orbit and reset", controlledNativePreferences: true, deviceAcceptance: false, artAcceptance: false }, installedNative: false,
    limitations: ["Actual App and renderer in Chrome with controlled native preferences; visual inspection is separate from final art and device acceptance.",
      "Observed object identity and disposal cover the exercised atlas and room only; no global GPU leak or release claim."] };
  page.on("pageerror", error => errors.push(error.message));
  await page.exposeBinding("__osPreference", (_source, operation, key, value, observed) => {
    operations.push({ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) });
    if (operation === "get") {
      return memory.get(key) ?? null;
    }
    if (operation === "set") { memory.set(key, value); return; }
    if (operation === "remove") { memory.delete(key); return; }
    throw Error("Unknown native preference fixture operation");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === "document" && url.pathname === "/") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/composition.css"></head><body><div id="root"></div><script src="/fixture/composition.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (!files.has(pathname) && selectedAssets.has(pathname)) {
      const entry = selectedAssets.get(pathname), filename = path.resolve(root, entry.source);
      if (await fs.realpath(filename) !== filename) throw Error("Linked selected asset");
      const bytes = await fs.readFile(filename);
      if (digest(bytes) !== entry.sourceSha256) throw Error("Stale selected fixture asset: " + entry.output);
      files.set(pathname, bytes);
    }
    const bytes = files.get(pathname);
    if (bytes) {
      localAssetRequests.push(pathname);
      await route.fulfill({ contentType: mime[path.extname(pathname)] ?? "application/octet-stream", body: bytes });
      return;
    }
    if (pathname !== "/favicon.ico") missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture asset" });
  });
  try {
    await page.goto(origin + "/?country=russia&writer=dostoevsky#atlas"); await ready(page);
    return { page, memory, operations, result,
      verify() {
        expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value => value.operation !== "get" && legacyKeys.includes(value.key))).toEqual([]);
        result.pass = true;
      },
      async close() {
        result.lastScene = await sample(page); result.preferenceOperations = operations;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources; result.localAssetRequests = localAssetRequests;
        const evidence = testInfo.outputPath("writer-study-map-proof.json");
        await fs.writeFile(evidence, JSON.stringify(result, null, 2) + "\n");
        await testInfo.attach("writer-study-map-proof", { path: evidence, contentType: "application/json" });
        await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

const sample = page => page.evaluate(() => window.__compositionSample?.() ?? null);
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready");
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await page.evaluate(() => window.__editionBootstrapError ?? null)).toBeNull();
}
async function stablePose(page) {
  let previous, value, matches = 0;
  await expect.poll(async () => {
    value = (await sample(page)).pose;
    const key = JSON.stringify(value); matches = key === previous ? matches + 1 : 0; previous = key;
    return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
  return value;
}
async function show(page, part) {
  const toggle = page.locator("[data-planet-stand-toggle]");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  const panel = page.locator(`[data-planet-${part}-panel]`);
  if (!await panel.isVisible()) await page.locator(`[data-planet-customization-tab="${part}"]`).click();
  await expect(panel).toBeVisible(); return panel;
}
async function preview(page, part, id) {
  const panel = await show(page, part);
  await panel.locator(`[data-planet-${part}-select]`).selectOption(id);
  await expect(panel).toHaveAttribute(`data-planet-${part}-phase`, "preview");
  await expect(panel.locator(`[data-planet-${part}-apply]`)).toBeEnabled(); return panel;
}

async function chooseEdition(page, edition) {
  const select = page.locator('.globe-edition-compact-select select');
  if (await select.isVisible()) await select.selectOption(edition);
  else {
    const option = page.locator(`button[data-globe-edition-option="${edition}"]`);
    if (!await option.isVisible()) await page.locator('[data-globe-control="edition-rail-toggle"]').click();
    await option.click();
  }
}
async function observe(page, { edition = 'natural-earth-2026', background = STUDY } = {}) {
  let value;
  await expect.poll(async () => {
    value = await sample(page);
    return value ? { edition: value.editionId, background: value.backgroundId, uploaded: value.uploadedVersion === value.mapVersion } : null;
  }).toEqual({ edition, background, uploaded: true });
  expect(value.surfaceCount).toBe(1); expect(value.canvasCount).toBe(1); expect(value.frame).toBeGreaterThan(0);
  expect(value.contextLost).toBe(false); expect(value.gpuAllocated).toBe(true);
  expect(value.wallMap?.sameTexture).toBe(true);
  if (value.identities) for (const [key, same] of Object.entries(value.identities)) expect(same, key).toBe(true);
  expect(value.atlasDisposals).toBe(0); expect(value.atlasCloneCalls).toEqual([]); expect(value.roomDisposals).toEqual([]);
  return value;
}
async function closeRail(page) {
  const toggle = page.locator('[data-globe-control="edition-rail-toggle"]');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
}
async function orbitUntilMapVisible(page, { minimumSteps = 0, key = 'ArrowRight' } = {}) {
  const globe = page.locator('#atlas .literary-globe'); await globe.focus();
  let value;
  for (let step = 0; step < 14; step++) {
    value = await sample(page);
    const map = value.wallMap;
    if (step >= minimumSteps && map.sightlineGlobeClearance > 1.15 && map.projectedCorners.every(point =>
      Math.abs(point[0]) < .94 && Math.abs(point[1]) < .94 && point[2] > -1 && point[2] < 1)) {
      await stablePose(page); return value;
    }
    // A real documented keyboard action; never assign camera pose/projection.
    await globe.press(key);
    await expect(globe).toHaveAttribute('data-globe-camera-phase', 'idle');
    await stablePose(page);
  }
  throw Error('Wall map not visible using bounded actual keyboard orbit: ' + JSON.stringify(value?.wallMap));
}
async function screenshot(page, testInfo, result, filename) {
  const bytes = await page.screenshot({ path: testInfo.outputPath(filename) });
  result.screenshots.push({ filename, sha256: digest(bytes), ...page.viewportSize(), framing: 'actual user keyboard orbit; original persistent camera' });
}

test('writer study wall map shares the live atlas through edition and background previews', async ({}, testInfo) => {
  const selection = { editionId: 'natural-earth-2026', standId: TOLSTOY, backgroundId: STUDY };
  const record = JSON.stringify({ schemaVersion: 1, commitId: 'writer-study-map-fixture:1', selection });
  const fixture = await open(testInfo, { newValue: record }), { page } = fixture;
  try {
    const globe = page.locator('#atlas .literary-globe');
    await expect(globe).toHaveAttribute('data-planet-composition-phase', 'idle');
    await observe(page);
    await page.keyboard.press('Escape'); await page.locator('[data-globe-control="reset"]').click();
    await stablePose(page); await page.evaluate(() => window.__rememberStudyMap());
    const initial = await observe(page); fixture.result.observations.initial = initial;
    expect(initial.wallMap.indexCount).toBeGreaterThanOrEqual(6);
    expect(initial.wallMap.frame.indexCount).toBeGreaterThan(24);
    expect(initial.wallMap.frame.bounds.max[2] - initial.wallMap.frame.bounds.min[2]).toBeGreaterThan(.02);
    expect(initial.observedRoomResourceCount).toBeGreaterThan(3);
    const semanticUrl = page.url();
    const ruView = await orbitUntilMapVisible(page);
    await screenshot(page, testInfo, fixture.result, 'writer-study-wall-map-ru-1440.png');
    fixture.result.observations.ruView = ruView;
    const pose = await stablePose(page);

    await page.locator('.native-planet-app .atlas-immersive-chrome .interface-language-control button').filter({ hasText: /^EN$/u }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(globe).toHaveAttribute('data-planet-composition-phase', 'idle');
    await expect.poll(async () => (await sample(page)).fingerprint).not.toBe(initial.fingerprint);
    const localized = await observe(page); fixture.result.observations.localized = localized;
    expect(localized.pose).toEqual(pose); expect(page.url()).toBe(semanticUrl);
    expect(localized.mapVersion).toBeGreaterThan(initial.mapVersion);

    // Edition selection is an immediate atomic composition commit, not an
    // editor draft. Only the subsequent background selection is cancelled.
    await chooseEdition(page, 'hondius-1615');
    await expect(globe).toHaveAttribute('data-planet-composition-phase', 'idle');
    const editionCommitted = await observe(page, { edition: 'hondius-1615' });
    expect(editionCommitted.fingerprint).not.toBe(localized.fingerprint);
    expect(editionCommitted.mapVersion).toBeGreaterThan(localized.mapVersion);
    expect(editionCommitted.pose).toEqual(pose);
    const committedSelection = { ...selection, editionId: 'hondius-1615' };
    await expect.poll(() => JSON.parse(fixture.memory.get(KEY)).selection).toEqual(committedSelection);
    const writes = () => fixture.operations.filter(value => value.operation === 'set' && value.key === KEY);
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(writes()[0].value).selection).toEqual(committedSelection);
    expect(writes()[0].observed.wallMap.sameTexture).toBe(true);
    const committedRecord = fixture.memory.get(KEY);
    fixture.result.observations.editionCommitted = editionCommitted;
    await closeRail(page);

    const panel = await preview(page, 'background', LIBRARY);
    const backgroundPreview = await observe(page, { edition: 'hondius-1615', background: LIBRARY });
    expect(backgroundPreview.visibleStudy).toBe(false);
    expect(backgroundPreview.wallMap.retainedSameTexture).toBe(true);
    expect(backgroundPreview.pose).toEqual(pose); expect(fixture.memory.get(KEY)).toBe(committedRecord);
    fixture.result.observations.backgroundPreview = backgroundPreview;
    await panel.locator('[data-planet-background-cancel]').click();
    await expect(globe).toHaveAttribute('data-planet-composition-phase', 'idle');
    const backgroundCancelled = await observe(page, { edition: 'hondius-1615' });
    expect(backgroundCancelled.study.uuid).toBe(initial.study.uuid);
    expect(backgroundCancelled.wallMap.uuid).toBe(initial.wallMap.uuid);
    expect(backgroundCancelled.wallMap.frame.uuid).toBe(initial.wallMap.frame.uuid);
    expect(backgroundCancelled.pose).toEqual(pose);
    expect(backgroundCancelled.fingerprint).toBe(editionCommitted.fingerprint); expect(page.url()).toBe(semanticUrl);
    fixture.result.observations.backgroundCancelled = backgroundCancelled;

    const enView = await orbitUntilMapVisible(page, { minimumSteps: 1, key: 'ArrowUp' });
    await screenshot(page, testInfo, fixture.result, 'writer-study-wall-map-en-1440.png');
    fixture.result.observations.enView = enView;
    expect(enView.pose).not.toEqual(ruView.pose); expect(writes()).toHaveLength(1);
    expect(fixture.memory.get(KEY)).toBe(committedRecord);
    fixture.result.identity = backgroundCancelled.identities;
    fixture.result.atlasCloneCalls = backgroundCancelled.atlasCloneCalls;
    fixture.result.atlasDisposals = backgroundCancelled.atlasDisposals;
    fixture.result.roomDisposals = backgroundCancelled.roomDisposals;
    fixture.verify();
  } finally { await fixture.close(); }
});
