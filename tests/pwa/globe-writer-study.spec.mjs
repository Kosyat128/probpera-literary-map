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
const origin = "https://globe-writer-study.test";
const ANTIQUE = "rand-mcnally-1887";
const KEY = "probpera-planet-composition-v1", STAND_KEY = "probpera-planet-stand-v1";
const EDITION_KEY = "probpera.globe-edition.v2", BACKGROUND_KEY = "probpera-planet-background-v1";
const WOOD = "stand.base.wood";
const STUDY = "background.base.writer-study", TOLSTOY = "stand.base.portrait-tolstoy";
const DEFAULT = "background.base.site-starfield", LIBRARY = "background.base.library";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-writer-study-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
    import{Box3,Matrix4,Vector3}from'three';
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
  sourceEvidence = { kind: "canonical-app-writer-study-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins and local preferences"],
    observation: "Actual writer study furniture, resource-preserving preview cancellation, same-frame whole composition save, projected parallax, graphics tiers, locale and local-asset reload",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

const selectionOf = value => ({ editionId: value.editionId, standId: value.standId, backgroundId: value.backgroundId });
const legacyKeys = [EDITION_KEY, "probpera.globe-style.v1", STAND_KEY, BACKGROUND_KEY];

async function open(testInfo, { newValue } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-writer-study"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "co-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"],
    [EDITION_KEY, "modern"], [STAND_KEY, WOOD], [BACKGROUND_KEY, LIBRARY]]);
  if (newValue !== undefined) memory.set(KEY, newValue);
  const operations = [], errors = [], externalRequests = [], missingResources = [], localAssetRequests = [];
  const result = { ...sourceEvidence, pass: false, observations: null, installedNative: false,
    limitations: ["Actual App and renderer in Chrome with controlled native preferences; visual inspection is separate from final art and device acceptance.",
      "Document reload preserves the Node-owned preference map; no claim of crash-safe native transaction or release readiness."] };
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
        const evidence = testInfo.outputPath("globe-writer-study.json");
        await fs.writeFile(evidence, JSON.stringify(result, null, 2) + "\n");
        await testInfo.attach("writer-study-source-evidence", { path: evidence, contentType: "application/json" });
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
async function actual(page, selection) {
  let observed;
  await expect.poll(async () => {
    observed = await sample(page);
    return observed ? selectionOf(observed) : null;
  }).toEqual(selection);
  expect(observed.surfaceCount).toBe(1); expect(observed.frame).toBeGreaterThan(0);
  expect(observed.standCount).toBe(selection.standId === "canonical" ? 0 : 1);
  expect(observed.backgroundCount).toBe(selection.backgroundId === DEFAULT ? 0 : 1);
  expect(observed.contextLost).toBe(false);
  return observed;
}
async function rememberScene(page) {
  await page.evaluate(() => { window.__compositionOriginal = window.__editionScene.scenes()
    .find(value => document.querySelector("#atlas").contains(value.canvas)); });
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
function retained(current, original, pose) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture);
  if (pose) expect(current.pose).toEqual(pose);
}
async function saved(fixture, selection, count) {
  await expect.poll(() => {
    const raw = fixture.memory.get(KEY);
    return raw ? JSON.parse(raw).selection : null;
  }).toEqual(selection);
  const writes = fixture.operations.filter(value => value.operation === "set" && value.key === KEY);
  expect(writes).toHaveLength(count);
  for (const write of writes) {
    const record = JSON.parse(write.value);
    expect(Object.keys(record).sort()).toEqual(["commitId", "schemaVersion", "selection"]);
    expect(record.schemaVersion).toBe(1); expect(record.commitId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u);
    expect(selectionOf(write.observed)).toEqual(record.selection);
    expect(write.observed.frame).toBeGreaterThan(0); expect(write.observed.surfaceCount).toBe(1);
    expect(write.observed.contextLost).toBe(false);
    expect(write.observed.gpuAllocated).toBe(true);
    expect(write.observed.uploadedVersion).toBe(write.observed.mapVersion);
  }
  expect(new Set(writes.map(write => JSON.parse(write.value).commitId)).size).toBe(writes.length);
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
async function chooseQuality(page,tier) {
  const panel=page.locator('.native-planet-panel');
  await page.locator('[data-atlas-action="open-collection"]').click();
  await expect(panel).toBeVisible();
  const settings=panel.locator('[data-planet-graphics-settings]');
  if(await settings.getAttribute('open')===null)await settings.locator('summary').click();
  await settings.locator('[data-planet-quality-option="'+tier+'"]').check();
  await expect(settings.locator('[data-planet-quality-save-state]')).toHaveAttribute('data-planet-quality-save-state','idle');
  await panel.getByRole('button',{name:/^(Вернуться к планете|Return to the planet)$/u}).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-quality-tier',tier);
  await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
  await expect.poll(async()=>(await sample(page)).quality).toBe(tier);
  await stablePose(page);
  return sample(page);
}


const resourceIds = resources => [...new Set(['geometries','materials','textures','instances'].flatMap(key=>resources[key]))];
async function expectDisposals(page,resources,count) {
  const ids=resourceIds(resources);
  await expect.poll(()=>page.evaluate(ids=>window.__resourceLedger().filter(row=>ids.includes(row.uuid)).map(row=>row.disposals),ids))
    .toEqual(ids.map(()=>count));
}
function assertStudy(observed) {
  expect(observed.backgroundId).toBe(STUDY); expect(observed.study).not.toBeNull();
  const {study}=observed;
  expect(study.meshes).toBeGreaterThan(4); expect(study.triangles).toBeGreaterThan(100);
  expect(study.textures.length).toBeGreaterThan(0);
  expect(study.layers.map(layer=>layer.name)).toEqual(['writer-study-foreground','writer-study-midground','writer-study-background']);
  for(const layer of study.layers) {
    expect(layer.meshes).toBeGreaterThan(0); expect(layer.instances).toBeGreaterThan(0);
    expect(layer.anchor.world.every(Number.isFinite)).toBe(true);
    expect(layer.anchor.projected.every(Number.isFinite)).toBe(true);
  }
  expect(study.landmarks.find(mesh=>mesh.name==='writer-study-book-page-blocks').instances).toBe(192);
  expect(study.landmarks.find(mesh=>mesh.name==='writer-study-window-glazing').instances).toBe(2);
  for(const mesh of study.landmarks) {
    expect(mesh.bounds.min.every(Number.isFinite)).toBe(true); expect(mesh.bounds.max.every(Number.isFinite)).toBe(true);
    expect(mesh.bounds.max.some((value,axis)=>value>mesh.bounds.min[axis])).toBe(true);
  }
  return study;
}
function expectStudyLayout(current,original) {
  const a=assertStudy(current),b=assertStudy(original);
  expect(a.landmarks.map(mesh=>mesh.name)).toEqual(b.landmarks.map(mesh=>mesh.name));
  for(let index=0;index<a.landmarks.length;index++) {
    const currentMesh=a.landmarks[index],originalMesh=b.landmarks[index];
    expect(currentMesh.instances).toBe(originalMesh.instances); expect(currentMesh.matrix).toEqual(originalMesh.matrix);
    expect(currentMesh.placements).toBe(originalMesh.placements); expect(currentMesh.colors).toBe(originalMesh.colors);
    // Desk, cabinets, windows and page blocks retain the actual same layout.
    // Curved lamp tessellation may slightly change its computed bounding box.
    if(currentMesh.name!=='writer-study-lamp-shade') {
      for(const edge of ['min','max'])for(let axis=0;axis<3;axis++)
        expect(currentMesh.bounds[edge][axis]).toBeCloseTo(originalMesh.bounds[edge][axis],4);
    }
  }
}
async function dragPlanet(page) {
  const point=await page.locator('#atlas canvas').evaluate(canvas=>{
    const rect=canvas.getBoundingClientRect();
    for(const fx of [.34,.44,.54])for(const fy of [.28,.38,.48]) {
      const x=rect.x+rect.width*fx,y=rect.y+rect.height*fy;
      if(document.elementFromPoint(x,y)===canvas&&document.elementFromPoint(x+60,y+15)===canvas)return{x,y};
    }
    throw Error('No unobstructed actual canvas drag area');
  });
  await page.mouse.move(point.x,point.y); await page.mouse.down();
  await page.mouse.move(point.x+60,point.y+15,{steps:8}); await page.mouse.up();
  await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-camera-phase','idle');
  await stablePose(page);
}

test("writer study preserves a cancelled library and the live composition across quality, locale and local-asset reload",async({},testInfo)=>{
  const initial={editionId:ANTIQUE,standId:TOLSTOY,backgroundId:LIBRARY};
  const selection={...initial,backgroundId:STUDY};
  const fixture=await open(testInfo,{newValue:JSON.stringify({schemaVersion:1,commitId:'writer-study-fixture:1',selection:initial})});
  const {page}=fixture;
  try {
    await actual(page,initial); await rememberScene(page);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
    await page.keyboard.press('Escape'); await page.locator('[data-globe-control="reset"]').click();
    const pose=await stablePose(page),baseline=await actual(page,initial),semanticUrl=page.url();
    expect(baseline.quality).toBe('high'); expect(baseline.libraryDensity.books).toBe(984);
    const panel=await show(page,'background');
    await expect(panel.locator('[data-planet-background-option="'+STUDY+'"]')).toHaveText('Кабинет писателя');
    await preview(page,'background',STUDY);
    const draft=await actual(page,selection); assertStudy(draft); retained(draft,baseline,pose);
    expect(draft.geometry).toBe(baseline.geometry); expect(draft.standResources).toEqual(baseline.standResources); expect(page.url()).toBe(semanticUrl);
    expect(JSON.parse(fixture.memory.get(KEY)).selection).toEqual(initial);
    await expectDisposals(page,baseline.backgroundResources,0);
    await page.screenshot({path:testInfo.outputPath('writer-study-preview-high-ru-1440.png')});
    await page.locator('.native-planet-app .interface-language-control button').filter({hasText:'EN'}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect(panel.locator('[data-planet-background-option="'+STUDY+'"]')).toHaveText("Writer's study");
    await expect(panel).toHaveAttribute('data-planet-background-phase','preview');
    const translatedDraft=await actual(page,selection); expectStudyLayout(translatedDraft,draft);
    expect(translatedDraft.backgroundResources.uuid).toBe(draft.backgroundResources.uuid);
    await panel.locator('[data-planet-background-cancel]').click();
    const cancelled=await actual(page,initial); retained(cancelled,baseline,pose);
    expect(cancelled.geometry).toBe(baseline.geometry); expect(cancelled.backgroundResources).toEqual(baseline.backgroundResources);
    expect(cancelled.standResources).toEqual(baseline.standResources);
    expect(page.url()).toBe(semanticUrl); await expectDisposals(page,draft.backgroundResources,1);
    await expectDisposals(page,baseline.backgroundResources,0);
    expect(fixture.operations.filter(row=>row.operation==='set'&&row.key===KEY)).toHaveLength(0);

    await preview(page,'background',STUDY);
    await page.locator('[data-planet-background-apply]').click(); await saved(fixture,selection,1);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
    await page.locator('[data-planet-background-cancel]').click();
    const high=await actual(page,selection); assertStudy(high); retained(high,baseline,pose);
    expect(high.geometry).toBe(baseline.geometry); expect(high.standResources).toEqual(baseline.standResources); expect(page.url()).toBe(semanticUrl);
    await expectDisposals(page,baseline.backgroundResources,1);
    await page.screenshot({path:testInfo.outputPath('writer-study-high-en-1440.png')});
    const balanced=await chooseQuality(page,'balanced'); expectStudyLayout(balanced,high); retained(balanced,high,pose);
    await page.screenshot({path:testInfo.outputPath('writer-study-balanced-en-1440.png')});
    const economy=await chooseQuality(page,'economy'); expectStudyLayout(economy,high); retained(economy,high,pose);
    expect(economy.study.triangles).toBeLessThan(high.study.triangles);
    await page.screenshot({path:testInfo.outputPath('writer-study-economy-en-1440.png')});
    expect(page.url()).toBe(semanticUrl); await saved(fixture,selection,1);

    await page.setViewportSize({width:390,height:844}); await stablePose(page);
    const narrow=await actual(page,selection); expectStudyLayout(narrow,high); retained(narrow,high);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('writer-study-economy-en-390.png')});
    await page.setViewportSize({width:1440,height:850}); await stablePose(page);
    const restoredHigh=await chooseQuality(page,'high'); expectStudyLayout(restoredHigh,high); retained(restoredHigh,high);
    await dragPlanet(page);
    const orbited=await actual(page,selection); retained(orbited,restoredHigh);
    expect(orbited.geometry).toBe(restoredHigh.geometry); expect(orbited.pose).not.toEqual(restoredHigh.pose); expect(page.url()).toBe(semanticUrl);
    const parallax=restoredHigh.study.layers.map((layer,index)=>{
      const next=orbited.study.layers[index].anchor;
      expect(next.key).toBe(layer.anchor.key); expect(next.world).toEqual(layer.anchor.world);
      return{layer:layer.name,from:layer.anchor.projected,to:next.projected,
        delta:next.projected.slice(0,2).map((value,axis)=>value-layer.anchor.projected[axis])};
    });
    expect(parallax.some(layer=>Math.hypot(...layer.delta)>.001)).toBe(true);
    expect(parallax.slice(1).some(layer=>Math.hypot(...layer.delta.map((value,axis)=>value-parallax[0].delta[axis]))>.001)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('writer-study-high-en-orbit-1440.png')});

    // The real App reloads using only the bundled source and hash-verified local
    // selected assets. Controlled native OS ports remain explicit fixture ports;
    // this is not an installed-device or service-worker offline acceptance.
    await page.reload(); await ready(page);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
    await stablePose(page);
    const reloaded=await actual(page,selection); expectStudyLayout(reloaded,high);
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await saved(fixture,selection,1); await expect(page.locator('canvas')).toHaveCount(1);
    await page.screenshot({path:testInfo.outputPath('writer-study-reloaded-en-1440.png')});
    fixture.result.observations={baseline,draft,translatedDraft,cancelled,high,balanced,economy,narrow,restoredHigh,orbited,parallax,reloaded};
    fixture.result.reloadDelivery="Intercepted hash-verified local assets and controlled native preferences";
    fixture.result.artAccepted=false; fixture.result.devicePerformanceAccepted=false; fixture.verify();
  } finally {await fixture.close();}
});
