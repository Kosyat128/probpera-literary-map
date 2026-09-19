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
const origin = "https://globe-surface-realism.test";
const ANTIQUE = "rand-mcnally-1887";
const KEY = "probpera-planet-composition-v1", STAND_KEY = "probpera-planet-stand-v1";
const EDITION_KEY = "probpera.globe-edition.v2", BACKGROUND_KEY = "probpera-planet-background-v1";
const MODERN = "natural-earth-2026", EARTH = "nasa-blue-marble", WOOD = "stand.base.wood";
const BOOKS = "stand.base.book-stack", DEFAULT = "background.base.site-starfield", LIBRARY = "background.base.library";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-surface-realism-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
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
    window.__compositionSample=()=>{
      const root=window.__editionScene.scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
      if(!root)return null;
      const stands=[],backgrounds=[],surfaces=[];
      root.scene.traverse(object=>{
        if(object.name.startsWith('included-globe-stand:'))stands.push({id:object.userData.standId,uuid:object.uuid});
        if(object.name.startsWith('included-globe-background:'))backgrounds.push({id:object.userData.backgroundId,uuid:object.uuid,quality:object.userData.qualityTier});
        if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1&&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surfaces.push(object);
      });
      const pages=root.scene.getObjectByName('library-book-page-blocks');
      const fingerprintFloats=array=>{let hash=2166136261;for(const value of array??[])hash=Math.imul(hash^(Math.round(value*1e5)>>>0),16777619)>>>0;return hash};
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
        standCount:stands.length,backgroundCount:backgrounds.length,surfaceCount:surfaces.length,libraryDensity,quality:backgrounds[0]?.quality??null,drawCalls:root.renderer.info.render.calls,triangles:root.renderer.info.render.triangles,
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
    "src/components/globeStandGeometry.ts", "src/components/globeTurnedWoodAtlas.ts", "src/components/globeCraftMaterials.ts", "src/host/PlanetStandControls.tsx", "src/host/planetComposition.ts", "src/planet/globeComposition.ts", "src/components/GlobeIncludedBackground.tsx", "src/components/globeLibraryGeometry.ts", "src/components/globeLibraryBookGeometry.ts"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-surface-realism-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins and local preferences"],
    observation: "Actual crafted surface maps through graphics quality changes, stand previews, narrow screen and owned texture retirement",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

const selectionOf = value => ({ editionId: value.editionId, standId: value.standId, backgroundId: value.backgroundId });
const baseSelection = { editionId: ANTIQUE, standId: "canonical", backgroundId: DEFAULT };
const legacySelection = { editionId: MODERN, standId: WOOD, backgroundId: LIBRARY };
const legacyKeys = [EDITION_KEY, "probpera.globe-style.v1", STAND_KEY, BACKGROUND_KEY];

async function open(testInfo, { newValue } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-surface"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "co-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"],
    [EDITION_KEY, "modern"], [STAND_KEY, WOOD], [BACKGROUND_KEY, LIBRARY]]);
  if (newValue !== undefined) memory.set(KEY, newValue);
  const state = { failRead: false, holdAsset: null, heldRequests: 0, heldDelivered: 0 };
  const held = [], operations = [], errors = [], externalRequests = [], missingResources = [];
  const releaseHeld = () => { state.holdAsset = null; for (const release of held.splice(0)) release(); };
  const result = { ...sourceEvidence, pass: false, observations: [], installedNative: false,
    limitations: ["Actual App and renderer in Chrome with controlled native preferences; visual inspection is separate from final art and device acceptance.",
      "Document reload preserves the Node-owned preference map; no claim of crash-safe native transaction or release readiness."] };
  page.on("pageerror", error => errors.push(error.message));
  await page.exposeBinding("__osPreference", (_source, operation, key, value, observed) => {
    operations.push({ operation, key, ...(value === undefined ? {} : { value }), ...(observed ? { observed } : {}) });
    if (operation === "get") {
      if (key === KEY && state.failRead) throw Error("Controlled composition read failure");
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
      const wait = state.holdAsset && pathname.includes(state.holdAsset);
      if (wait) { state.heldRequests++; await new Promise(resolve => held.push(resolve)); }
      await route.fulfill({ contentType: mime[path.extname(pathname)] ?? "application/octet-stream", body: bytes });
      if (wait) state.heldDelivered++;
      return;
    }
    if (pathname !== "/favicon.ico") missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture asset" });
  });
  try {
    await page.goto(origin + "/?country=russia&writer=dostoevsky#atlas"); await ready(page);
    return { page, memory, state, operations, result, releaseHeld,
      verify() {
        expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(value => value.operation !== "get" && legacyKeys.includes(value.key))).toEqual([]);
        result.pass = true;
      },
      async close() {
        releaseHeld();
        result.lastScene = await sample(page); result.preferenceOperations = operations;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const evidence = testInfo.outputPath("globe-surface-realism.json");
        await fs.writeFile(evidence, JSON.stringify(result, null, 2) + "\n");
        await testInfo.attach("surface-realism-source-evidence", { path: evidence, contentType: "application/json" });
        await context.close();
      } };
  } catch (error) { releaseHeld(); await context.close(); throw error; }
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
function retained(page, current, original, pose) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture); expect(current.geometry).toBe(original.geometry);
  if (pose) expect(current.pose).toEqual(pose);
  expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
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
async function chooseEdition(page, edition) {
  const select = page.locator(".globe-edition-compact-select select");
  if (await select.isVisible()) await select.selectOption(edition);
  else {
    const option = page.locator(`button[data-globe-edition-option="${edition}"]`);
    if (!await option.isVisible()) await page.locator('[data-globe-control="edition-rail-toggle"]').click();
    await option.click();
  }
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

test('crafted surfaces render across quality tiers and retire owned stand textures',async({},testInfo)=>{
  const selection={editionId:ANTIQUE,standId:BOOKS,backgroundId:LIBRARY};
  const fixture=await open(testInfo,{newValue:JSON.stringify({schemaVersion:1,commitId:'surface-fixture:1',selection})});
  const {page}=fixture;
  try {
    await actual(page,selection);await rememberScene(page);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
    await page.keyboard.press('Escape');await page.locator('[data-globe-control="reset"]').click();
    const pose=await stablePose(page),high=await actual(page,selection);
    expect(high.quality).toBe('high');expect(high.libraryDensity.books).toBeGreaterThanOrEqual(16*56);
    await page.screenshot({path:testInfo.outputPath('surface-realism-high-ru-1440.png')});
    const tiers=[];
    for(const tier of ['balanced','economy']) {
      const view=await chooseQuality(page,tier);
      expect(selectionOf(view)).toEqual(selection);expect(view.sameScene).toBe(true);
      expect(view.pose).toEqual(pose);expect(view.texture).toBe(high.texture);
      expect(view.libraryDensity).toEqual(high.libraryDensity);
      expect(view.triangles).toBeLessThan(high.triangles);
      await page.screenshot({path:testInfo.outputPath('surface-realism-'+tier+'-ru-1440.png')});tiers.push(view);
    }
    await page.locator('.native-planet-app .interface-language-control button').filter({hasText:'EN'}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-planet-composition-phase','idle');
    const english=await actual(page,selection);expect(english.libraryDensity).toEqual(high.libraryDensity);
    expect(english.sameScene).toBe(true);expect(english.pose).toEqual(pose);
    await page.setViewportSize({width:390,height:844});await stablePose(page);
    const narrow=await actual(page,selection);expect(narrow.libraryDensity).toEqual(high.libraryDensity);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('surface-realism-economy-en-390.png')});
    const restored=await chooseQuality(page,'high');expect(restored.libraryDensity).toEqual(high.libraryDensity);
    expect(restored.sameScene).toBe(true);expect(restored.texture).toBe(high.texture);
    await expect.poll(async()=>(await sample(page)).gpuMemory.textures).toBe(high.gpuMemory.textures);
    await page.setViewportSize({width:1440,height:850});await stablePose(page);
    const standViews=[];
    for(const standId of [WOOD,'stand.base.museum']) {
      const before=await sample(page),panel=await preview(page,'stand',standId);
      const view=await actual(page,{...selection,standId});
      expect(view.sameScene).toBe(true);expect(view.texture).toBe(high.texture);
      expect(view.pose).toEqual(before.pose);expect(view.libraryDensity).toEqual(high.libraryDensity);
      await page.screenshot({path:testInfo.outputPath(standId.slice('stand.base.'.length)+'-surface-library-1440.png')});
      await panel.locator('[data-planet-stand-cancel]').click();await actual(page,selection);
      await expect.poll(async()=>(await sample(page)).gpuMemory.textures).toBe(before.gpuMemory.textures);
      standViews.push({view,returnedTextures:before.gpuMemory.textures});
    }
    const sky=await preview(page,'background',DEFAULT);await sky.locator('[data-planet-background-apply]').click();
    const skySelection={...selection,backgroundId:DEFAULT};await actual(page,skySelection);
    const baseline=await sample(page);await preview(page,'background',LIBRARY);
    expect((await sample(page)).gpuMemory.textures).toBeGreaterThan(baseline.gpuMemory.textures);
    await page.locator('[data-planet-background-cancel]').click();await actual(page,skySelection);
    await expect.poll(async()=>(await sample(page)).gpuMemory.textures).toBe(baseline.gpuMemory.textures);
    expect(JSON.parse(fixture.memory.get(KEY)).selection).toEqual(skySelection);
    fixture.result.observations.push({high,tiers,english,narrow,restored,standViews,retiredToTextureBaseline:baseline.gpuMemory.textures});
    fixture.result.artAccepted=false;fixture.result.devicePerformanceAccepted=false;fixture.verify();
  } finally {await fixture.close();}
});
