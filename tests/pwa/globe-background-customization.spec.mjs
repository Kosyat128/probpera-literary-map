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
const origin = "https://globe-background-customization.test";
const ANTIQUE = "rand-mcnally-1887";
const KEY = "probpera-planet-background-v1", STAND_KEY = "probpera-planet-stand-v1";
const BOOKS = "stand.base.book-stack", DEFAULT = "background.base.site-starfield", LIBRARY = "background.base.library";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-background-customization-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
    import{Matrix4,Vector3,Vector2,Raycaster}from'three';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={
      core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),set:async({key,value})=>{
        if(key==='probpera-planet-background-v1')(window.__backgroundWrites??=[]).push({value,observed:window.__backgroundProbe?.sample()??null});
        await window.__osPreference('set',key,value)},remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},
      appLauncher:{openUrl:async()=>({completed:false})}
    };
    window.__editionScene={scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,frameloop:s.frameloop}}),
      back:()=>{const current=handles.filter(handle=>!handle.removed&&handle.event==='backButton');for(const handle of current)handle.listener({canGoBack:false});return current.length},
      active:value=>{active=value;const current=handles.filter(handle=>!handle.removed&&handle.event==='appStateChange');for(const handle of current)handle.listener({isActive:value});return current.length}};
    window.__standMath={Matrix4,Vector3,Vector2,Raycaster};
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__editionBootstrapError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "background-customization", assetNames: "assets/[name]-[hash]",
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
    "src/components/globeStandGeometry.ts", "src/host/PlanetStandControls.tsx", "src/components/GlobeIncludedBackground.tsx", "src/components/globeLibraryGeometry.ts"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-background-customization-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins, including explicit background-preference set failure"],
    observation: "Actual library depth geometry, projected parallax, emissive animation and persistent canonical scene; no production probes",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

async function open(testInfo, { failSave = false, motion = false } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-background-customization"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "bc-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: motion ? "no-preference" : "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"], [STAND_KEY, BOOKS]]);
  const state = { failSave }, operations = [], errors = [], externalRequests = [], missingResources = [];
  const result = { ...sourceEvidence, pass: false, observations: [], installedNative: false,
    limitations: ["One included library background at Home and a bounded manual orbit; no all-camera, device or release acceptance.",
      "Disposal evidence covers observed library geometry/materials/texture maps/instances; source fixture native OS ports are controlled."] };
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__backgroundUiTrace = [];
    new MutationObserver(() => {
      const panel = document.querySelector("[data-planet-background-panel]");
      if (!panel) return;
      const scene = window.__editionScene?.scenes().find(value => document.querySelector("#atlas")?.contains(value.canvas));
      const row = { phase: panel.getAttribute("data-planet-background-phase"),
        choice: panel.querySelector("[data-planet-background-select]")?.value,
        applyDisabled: panel.querySelector("[data-planet-background-apply]")?.disabled,
        frame: scene?.renderer.info.render.frame ?? null };
      const previous = window.__backgroundUiTrace[window.__backgroundUiTrace.length - 1];
      if (!previous || previous.phase !== row.phase || previous.choice !== row.choice || previous.applyDisabled !== row.applyDisabled) {
        window.__backgroundUiTrace.push(row);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-planet-background-phase", "disabled"] });
  });
  await page.exposeBinding("__osPreference", (_source, operation, key, value) => {
    if (operation === "get") return memory.get(key) ?? null;
    if (operation === "set") {
      if (key === KEY) {
        operations.push({ operation, key, value, accepted: !state.failSave });
        if (state.failSave) throw Error("Controlled native background save failure");
      }
      memory.set(key, value); return;
    }
    if (operation === "remove") { memory.delete(key); return; }
    throw Error("Unknown native preference fixture operation");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === "document" && url.pathname === "/") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/background-customization.css"></head><body><div id="root"></div><script src="/fixture/background-customization.js"></script></body></html>' }); return;
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
    if (bytes) { await route.fulfill({ contentType: mime[path.extname(pathname)] ?? "application/octet-stream", body: bytes }); return; }
    if (pathname !== "/favicon.ico") missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture asset" });
  });
  try {
    await page.goto(origin + "/?country=russia&writer=dostoevsky#atlas"); await ready(page);
    await installProbe(page);
    return { page, memory, state, operations, result,
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true; },
      async close() {
        result.lastScene = await page.evaluate(() => window.__backgroundProbe?.sample() ?? null);
        result.disposalLedger = await page.evaluate(() => window.__backgroundProbe?.ledger() ?? []);
        result.preferenceWritesAtRender = await page.evaluate(() => window.__backgroundWrites ?? []);
        result.uiRenderTrace = await page.evaluate(() => window.__backgroundUiTrace ?? []);
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        await fs.writeFile(testInfo.outputPath("globe-background-customization.json"), JSON.stringify(result, null, 2) + "\n");
        await page.evaluate(() => window.__backgroundProbe?.disconnect()); await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready");
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-edition", ANTIQUE);
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await page.evaluate(() => window.__editionBootstrapError ?? null)).toBeNull();
}

async function installProbe(page) {
  await page.evaluate(() => {
    const { Matrix4, Vector3, Vector2, Raycaster } = window.__standMath;
    const original = window.__editionScene.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
    if (!original) throw Error("Missing canonical scene");
    const resources = new Map(), anchorSets = new Map();
    let current = new Set();
    function watch(object, kind) {
      if (resources.has(object.uuid)) return;
      const row = { object, kind, disposals: 0, listener: () => { row.disposals++; } };
      object.addEventListener("dispose", row.listener); resources.set(object.uuid, row);
    }
    const ledger = () => [...resources].map(([uuid, row]) => ({ uuid, kind: row.kind,
      current: current.has(uuid), disposals: row.disposals }));
    const matrix = (mesh, instance) => {
      const world = new Matrix4().copy(mesh.matrixWorld);
      if (mesh.isInstancedMesh) { const transform = new Matrix4(); mesh.getMatrixAt(instance, transform); world.multiply(transform); }
      return world;
    };
    const location = anchor => new Vector3().fromBufferAttribute(anchor.mesh.geometry.getAttribute("position"), anchor.vertex)
      .applyMatrix4(matrix(anchor.mesh, anchor.instance));
    const sample = () => {
      const state = window.__editionScene.scenes().find(value => value.canvas === original.canvas);
      const backgrounds = [], stands = [], surfaces = [];
      original.scene.traverse(object => {
        if (object.name.startsWith("included-globe-background:")) backgrounds.push(object);
        if (object.name.startsWith("included-globe-stand:")) {
          const geometries = new Set(), materials = new Set();
          object.traverse(mesh => {
            if (!mesh.isMesh) return;
            geometries.add(mesh.geometry.uuid);
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material.uuid);
          });
          stands.push({ id: object.userData.standId, uuid: object.uuid,
            geometries: [...geometries].sort(), materials: [...materials].sort() });
        }
        if (object.isMesh && object.geometry?.type === "SphereGeometry" && object.geometry.parameters.radius === 1
          && object.material?.isMeshPhysicalMaterial && object.material.map?.isCanvasTexture) surfaces.push(object);
      });
      if (backgrounds.length > 1 || surfaces.length !== 1) throw Error("Expected one background slot and one canonical globe surface");
      current = new Set();
      const library = backgrounds.map(group => {
        const geometryIds = new Set(), materialIds = new Set(), textureIds = new Set(), ambient = new Map();
        const depths = ["library-foreground", "library-midground", "library-background"].map(name => {
          const layer = group.getObjectByName(name);
          if (!layer) throw Error("Missing actual library depth root: " + name);
          let meshes = 0, instances = 0, opaqueMaterials = 0;
          const candidates = [];
          layer.traverse(mesh => {
            if (!mesh.isMesh) return;
            meshes++; instances += mesh.isInstancedMesh ? mesh.count : 1;
            if (mesh.isInstancedMesh) { watch(mesh, "instance"); current.add(mesh.uuid); }
            watch(mesh.geometry, "geometry"); current.add(mesh.geometry.uuid); geometryIds.add(mesh.geometry.uuid);
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              watch(material, "material"); current.add(material.uuid); materialIds.add(material.uuid);
              for (const value of Object.values(material)) if (value?.isTexture) {
                watch(value, "texture"); current.add(value.uuid); textureIds.add(value.uuid);
              }
              if (!material.transparent && material.opacity === 1) opaqueMaterials++;
              if (material.userData.ambientChannel === "reading-lamps") {
                ambient.set(material.uuid, { uuid: material.uuid, channel: material.userData.ambientChannel,
                  emissiveIntensity: material.emissiveIntensity });
              }
            }
            const position = mesh.geometry.getAttribute("position");
            const count = mesh.isInstancedMesh ? mesh.count : 1;
            for (const instance of new Set([0, Math.floor(count / 4), Math.floor(count / 2), count - 1])) {
              for (const vertex of new Set([0, Math.floor(position.count / 2), position.count - 1])) {
                const anchor = { mesh, instance, vertex, key: mesh.uuid + ":" + instance + ":" + vertex };
                const world = location(anchor), projected = world.clone().project(original.camera);
                const visible = Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z > -1 && projected.z < 1;
                candidates.push({ anchor, visible, score: (visible ? 0 : 100) + Math.abs(projected.x) + Math.abs(projected.y),
                  radius: world.length() });
              }
            }
          });
          const key = group.uuid + ":" + name;
          if (!anchorSets.has(key)) {
            candidates.sort((a, b) => a.score - b.score);
            if (!candidates.length) throw Error("Library layer contains no render geometry");
            anchorSets.set(key, candidates[0].anchor);
          }
          const anchor = anchorSets.get(key), world = location(anchor), projected = world.clone().project(original.camera);
          return { name, uuid: layer.uuid, meshes, instances, opaqueMaterials,
            sampledMinimumRadius: Math.min(...candidates.map(candidate => candidate.radius)),
            anchor: { key: anchor.key, world: world.toArray(), projected: projected.toArray(),
              visible: Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z > -1 && projected.z < 1 } };
        });
        // Lamps may be a direct child rather than a member of a depth root.
        group.traverse(mesh => {
          if (!mesh.isMesh) return;
          watch(mesh.geometry, "geometry"); current.add(mesh.geometry.uuid); geometryIds.add(mesh.geometry.uuid);
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            watch(material, "material"); current.add(material.uuid); materialIds.add(material.uuid);
            if (material.userData.ambientChannel === "reading-lamps") ambient.set(material.uuid, {
              uuid: material.uuid, channel: material.userData.ambientChannel, emissiveIntensity: material.emissiveIntensity });
          }
        });
        return { id: group.userData.backgroundId, uuid: group.uuid, provenance: group.userData.provenance,
          qualityTier: group.userData.qualityTier, cameraClearanceRadius: group.userData.cameraClearanceRadius,
          geometries: [...geometryIds].sort(), materials: [...materialIds].sort(), textures: [...textureIds].sort(), depths, ambient: [...ambient.values()] };
      });
      const surface = surfaces[0], map = surface.material.map;
      const center = new Vector3().setFromMatrixPosition(surface.matrixWorld).project(original.camera);
      const ray = new Raycaster(); ray.setFromCamera(new Vector2(center.x, center.y), original.camera);
      return { sameScene: original.canvas.isConnected && state?.renderer === original.renderer
          && state?.camera === original.camera && state?.scene === original.scene,
        pose: { position: original.camera.position.toArray().map(value => Number(value.toFixed(5))),
          quaternion: original.camera.quaternion.toArray().map(value => Number(value.toFixed(5))), zoom: original.camera.zoom },
        globeSurface: { geometry: surface.geometry.uuid, texture: map.uuid, raycastHits: ray.intersectObject(surface, false).length },
        stands, backgrounds: library, frameloop: state?.frameloop, renderFrame: original.renderer.info.render.frame,
        gpuMemory: { ...original.renderer.info.memory },
        motion: { autoRotateStatus: document.querySelector("#atlas .literary-globe")?.getAttribute("data-globe-auto-rotate"),
          autoRotateRequested: document.querySelector('[data-globe-control="auto-rotate"]')?.getAttribute("aria-pressed"),
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches },
        pendingDisposals: ledger().filter(row => !row.current && row.disposals !== 1).length };
    };
    window.__backgroundProbe = { sample, ledger, disconnect() {
      for (const row of resources.values()) row.object.removeEventListener("dispose", row.listener);
      resources.clear(); anchorSets.clear();
    } };
  });
}

const panel = page => page.locator("[data-planet-background-panel]");
const probe = page => page.evaluate(() => window.__backgroundProbe.sample());
async function rendered(page, id) {
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-background", id);
  let value;
  await expect.poll(async () => {
    value = await probe(page);
    return value.stands.length === 1 && value.stands[0].id === BOOKS &&
      (id === DEFAULT ? value.backgrounds.length === 0 : value.backgrounds.length === 1 && value.backgrounds[0].id === id);
  }).toBe(true);
  return value;
}
async function show(page) {
  const toggle = page.locator("[data-planet-stand-toggle]");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  if (!await panel(page).isVisible()) await page.locator('[data-planet-customization-tab="background"]').click();
  await expect(panel(page)).toBeVisible();
  expect(await panel(page).getAttribute("aria-modal")).not.toBe("true");
}
async function preview(page, id = LIBRARY) {
  await show(page); await panel(page).locator("[data-planet-background-select]").selectOption(id);
  await expect(panel(page)).toHaveAttribute("data-planet-background-phase", "preview");
  await expect(panel(page).locator("[data-planet-background-apply]")).toBeEnabled();
  return rendered(page, id);
}
async function language(page, locale) {
  await page.locator(".native-planet-app .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function stablePose(page) {
  let previous, value, matches = 0;
  await expect.poll(async () => {
    value = (await probe(page)).pose;
    const key = JSON.stringify(value); matches = key === previous ? matches + 1 : 0; previous = key;
    return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
  return value;
}
async function home(page) {
  await page.locator('[data-globe-control="reset"]').click();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
}
function retained(page, snapshot, original, pose, selection = { country: "russia", writer: "dostoevsky" }) {
  expect(snapshot.sameScene).toBe(true);
  expect(snapshot.globeSurface.geometry).toBe(original.globeSurface.geometry);
  expect(snapshot.globeSurface.texture).toBe(original.globeSurface.texture);
  expect(snapshot.globeSurface.raycastHits).toBeGreaterThan(0);
  expect(snapshot.stands).toEqual(original.stands);
  if (pose) expect(snapshot.pose).toEqual(pose);
  expect(new URL(page.url()).searchParams.get("country")).toBe(selection.country);
  expect(new URL(page.url()).searchParams.get("writer")).toBe(selection.writer);
}
function actualLibrary(snapshot) {
  expect(snapshot.backgrounds).toHaveLength(1);
  const library = snapshot.backgrounds[0];
  expect(library).toMatchObject({ id: LIBRARY, provenance: "authored-in-project", cameraClearanceRadius: 5.6 });
  expect(library.depths.map(layer => layer.name)).toEqual(["library-foreground", "library-midground", "library-background"]);
  for (const layer of library.depths) {
    expect(layer.meshes).toBeGreaterThan(0); expect(layer.instances).toBeGreaterThan(0);
    expect(layer.sampledMinimumRadius).toBeGreaterThanOrEqual(5.6 - 0.0001);
  }
  expect(library.depths[2].opaqueMaterials).toBeGreaterThan(0);
  expect(library.ambient.length).toBeGreaterThan(0);
  expect(library.textures.length).toBeGreaterThan(0);
  return library;
}
async function dragPlanet(page) {
  const point = await page.locator("#atlas canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    for (const fx of [.34, .44, .54]) for (const fy of [.28, .38, .48]) {
      const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
      if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x + 60, y + 15) === canvas) return { x, y };
    }
    throw Error("Appearance controls leave no tested canvas drag area");
  });
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 60, point.y + 15, { steps: 8 }); await page.mouse.up();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
}
async function liveFrames(page, count = 18) {
  await page.evaluate(count => new Promise(resolve => {
    let elapsed = 0; const step = () => { if (++elapsed === count) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), count);
}

async function recoverActualContext(page, original) {
  const contextProbe = await page.evaluateHandle(() => {
    const state = window.__editionScene.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
    const context = state.renderer.getContext(), extension = context.getExtension("WEBGL_lose_context");
    if (!extension) throw Error("Chrome must expose WEBGL_lose_context for real recovery evidence");
    const events = [];
    const observe = event => events.push({ type: event.type, trusted: event.isTrusted, contextLost: context.isContextLost() });
    state.canvas.addEventListener("webglcontextlost", observe);
    state.canvas.addEventListener("webglcontextrestored", observe);
    return { lose: () => extension.loseContext(), snapshot: () => ({ events: [...events], contextLost: context.isContextLost() }),
      dispose() { state.canvas.removeEventListener("webglcontextlost", observe); state.canvas.removeEventListener("webglcontextrestored", observe); } };
  });
  try {
    await contextProbe.evaluate(value => value.lose());
    const globe = page.locator("#atlas .literary-globe");
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "lost");
    await expect.poll(async () => (await probe(page)).frameloop).toBe("never");
    await globe.getByRole("button", { name: /^(?:Restore globe|Восстановить глобус)$/u }).click();
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 20_000 });
    await expect.poll(() => contextProbe.evaluate(value => value.snapshot().contextLost)).toBe(false);
    const recovered = await rendered(page, LIBRARY);
    retained(page, recovered, original);
    expect(recovered.backgrounds[0].uuid).toBe(original.backgrounds[0].uuid);
    expect(recovered.backgrounds[0].geometries).toEqual(original.backgrounds[0].geometries);
    expect(recovered.backgrounds[0].materials).toEqual(original.backgrounds[0].materials);
    expect(recovered.backgrounds[0].textures).toEqual(original.backgrounds[0].textures);
    const events = await contextProbe.evaluate(value => value.snapshot().events);
    expect(events).toEqual([
      { type: "webglcontextlost", trusted: true, contextLost: true },
      { type: "webglcontextrestored", trusted: true, contextLost: false },
    ]);
    return { actualExtension: "WEBGL_lose_context", syntheticEvents: false, events, recovered };
  } finally {
    await contextProbe.evaluate(value => value.dispose()); await contextProbe.dispose();
  }
}

test("library preview renders real depth and manual-orbit parallax while preserving the globe, stand and locale draft", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page } = fixture;
  try {
    await rendered(page, DEFAULT); await home(page); const homePose = await stablePose(page);
    const initial = await rendered(page, DEFAULT);
    const draft = await preview(page), before = actualLibrary(draft);
    retained(page, draft, initial, homePose); expect(fixture.operations).toEqual([]);
    const trace = await page.evaluate(() => window.__backgroundUiTrace.filter(row => row.choice === "background.base.library"));
    const preparing = trace.find(row => row.phase === "preparing"), acknowledged = trace.find(row => row.phase === "preview");
    expect(preparing).toMatchObject({ applyDisabled: true });
    expect(acknowledged).toMatchObject({ applyDisabled: false });
    expect(acknowledged.frame).toBeGreaterThan(preparing.frame);
    await page.screenshot({ path: testInfo.outputPath("library-home-preview-ru-1440.png") });
    await dragPlanet(page); const orbitPose = await stablePose(page);
    expect(orbitPose).not.toEqual(homePose);
    const orbited = await rendered(page, LIBRARY), after = actualLibrary(orbited);
    retained(page, orbited, initial, orbitPose);
    expect(after.uuid).toBe(before.uuid);
    const parallax = before.depths.map((layer, index) => {
      const next = after.depths[index].anchor;
      expect(next.key).toBe(layer.anchor.key); expect(next.world).toEqual(layer.anchor.world);
      return { layer: layer.name, from: layer.anchor.projected, to: next.projected,
        delta: next.projected.slice(0, 2).map((value, axis) => value - layer.anchor.projected[axis]) };
    });
    expect(parallax.some(layer => Math.hypot(...layer.delta) > 0.001)).toBe(true);
    expect(parallax.slice(1).some(layer => Math.hypot(...layer.delta.map((value, axis) => value - parallax[0].delta[axis])) > 0.001)).toBe(true);
    await language(page, "en");
    await expect(panel(page).locator("[data-planet-background-select]")).toHaveValue(LIBRARY);
    retained(page, await rendered(page, LIBRARY), initial, orbitPose);
    await panel(page).locator("[data-planet-background-cancel]").click();
    await expect(panel(page)).toBeHidden(); retained(page, await rendered(page, DEFAULT), initial, orbitPose);
    await expect.poll(async () => (await probe(page)).pendingDisposals).toBe(0);
    await expect.poll(async () => (await probe(page)).gpuMemory.textures).toBeLessThanOrEqual(initial.gpuMemory.textures);
    expect(fixture.operations).toEqual([]); expect(fixture.memory.has(KEY)).toBe(false);
    // Tabs edit one composition draft. Only explicit Cancel restores the
    // committed stand/background pair before the separate Apply path below.
    await preview(page);
    await page.locator('[data-planet-customization-tab="stand"]').click();
    const standPanel = page.locator("[data-planet-stand-panel]");
    await expect(standPanel).toBeVisible(); await expect(panel(page)).toBeHidden();
    const backgroundRetainedOnTab = await rendered(page, LIBRARY);
    retained(page, backgroundRetainedOnTab, initial, orbitPose);
    await standPanel.locator("[data-planet-stand-select]").selectOption("stand.base.museum");
    await expect(standPanel).toHaveAttribute("data-planet-stand-phase", "preview");
    await expect.poll(async () => (await probe(page)).stands.map(stand => stand.id)).toEqual(["stand.base.museum"]);
    const standDraft = await probe(page);
    expect(actualLibrary(standDraft).uuid).toBe(actualLibrary(backgroundRetainedOnTab).uuid);
    await page.locator('[data-planet-customization-tab="background"]').click();
    await expect(panel(page)).toBeVisible(); await expect(standPanel).toBeHidden();
    await expect(panel(page).locator('[data-planet-background-select]')).toHaveValue(LIBRARY);
    const standRetainedOnTab = await probe(page);
    expect(standRetainedOnTab.stands).toEqual(standDraft.stands);
    expect(actualLibrary(standRetainedOnTab).uuid).toBe(actualLibrary(backgroundRetainedOnTab).uuid);
    retained(page,standRetainedOnTab,{...initial,stands:standDraft.stands},orbitPose);
    expect(fixture.operations).toEqual([]); expect(fixture.memory.get(STAND_KEY)).toBe(BOOKS);
    await panel(page).locator('[data-planet-background-cancel]').click();
    await expect(panel(page)).toBeHidden();
    const explicitlyCancelled = await rendered(page,DEFAULT);
    retained(page,explicitlyCancelled,initial,orbitPose);
    await expect.poll(async () => (await probe(page)).pendingDisposals).toBe(0);
    await preview(page);
    await panel(page).locator("[data-planet-background-apply]").click();
    await expect.poll(() => fixture.memory.get(KEY)).toBe(LIBRARY);
    await panel(page).locator("[data-planet-background-close]").click();
    await expect(panel(page)).toBeHidden(); retained(page, await rendered(page, LIBRARY), initial, orbitPose);
    await home(page); await stablePose(page);
    await page.screenshot({ path: testInfo.outputPath("library-home-applied-en-1440.png") });
    await page.setViewportSize({ width: 390, height: 844 }); await home(page); await stablePose(page);
    const portrait = await rendered(page, LIBRARY); actualLibrary(portrait); retained(page, portrait, initial);
    await page.screenshot({ path: testInfo.outputPath("library-home-applied-en-390.png") });
    expect(fixture.memory.get(STAND_KEY)).toBe(BOOKS);
    expect(fixture.operations.map(call => [call.value, call.accepted])).toEqual([[LIBRARY, true]]);
    fixture.result.observations.push({ initial, draft, orbited, parallax, portrait, homePose, orbitPose,
      tabHandoff: { backgroundRetainedOnTab, standDraft, standRetainedOnTab, explicitlyCancelled },
      realDepthAndOrbitOnly: true, retainedStand: initial.stands, noPreviewWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test("failed background saving retains the rendered library, RUEN retry and cold restore work, backgrounding cancels drafts and pauses ambience", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { failSave: true, motion: true }), { page } = fixture;
  try {
    const initial = await rendered(page, DEFAULT); await home(page);
    const draft = await preview(page); actualLibrary(draft); retained(page, draft, initial);
    await panel(page).locator("[data-planet-background-apply]").click();
    await expect(page.locator('[data-planet-background-save-state="failed"]')).toBeVisible();
    retained(page, await rendered(page, LIBRARY), initial);
    expect(fixture.memory.has(KEY)).toBe(false);
    const write = await page.evaluate(() => window.__backgroundWrites[0]);
    expect(write.value).toBe(LIBRARY); expect(write.observed.backgrounds[0].id).toBe(LIBRARY);
    const visuals = [];
    await page.setViewportSize({ width: 320, height: 844 });
    for (const locale of ["ru", "en"]) {
      await language(page, locale);
      const retry = panel(page).locator("[data-planet-background-save-retry]");
      await expect(retry).toHaveText(locale === "ru" ? "Повторить сохранение" : "Try saving again");
      const geometry = await panel(page).evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, right: rect.right, scroll: element.scrollWidth, client: element.clientWidth,
          controls: [...element.querySelectorAll("button,select")].filter(node => node.getClientRects().length)
            .map(node => { const box = node.getBoundingClientRect(); return { width: box.width, height: box.height, right: box.right }; }) };
      });
      expect(geometry.x).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(320);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      for (const control of geometry.controls) {
        expect(control.height).toBeGreaterThanOrEqual(44); expect(control.width).toBeGreaterThanOrEqual(44);
        expect(control.right).toBeLessThanOrEqual(320);
      }
      retained(page, await rendered(page, LIBRARY), initial);
      visuals.push({ locale, width: 320, geometry });
      await page.screenshot({ path: testInfo.outputPath("library-save-failed-" + locale + "-320.png") });
    }
    fixture.state.failSave = false;
    const retry = panel(page).locator("[data-planet-background-save-retry]"); await retry.focus(); await retry.press("Enter");
    await expect.poll(() => fixture.memory.get(KEY)).toBe(LIBRARY);
    await expect(page.locator('[data-planet-background-save-state="failed"]')).toHaveCount(0);
    await panel(page).locator("[data-planet-background-close]").click();
    await page.setViewportSize({ width: 1440, height: 850 });
    await page.reload(); await ready(page); await installProbe(page);
    const restored = await rendered(page, LIBRARY), restoredLibrary = actualLibrary(restored);
    expect(fixture.memory.get(STAND_KEY)).toBe(BOOKS);
    const contextRecovery = await recoverActualContext(page, restored);
    const autoRotate = page.locator('[data-globe-control="auto-rotate"]');
    if (await autoRotate.getAttribute("aria-pressed") !== "true") await autoRotate.click();
    // Requested motion correctly stays paused while Russia is selected. The
    // preceding context-recovery checks already require that semantic state.
    await expect(autoRotate).toHaveAttribute("data-globe-auto-rotate-state", "selection");
    const selectionPaused = await probe(page);
    retained(page, selectionPaused, restored);
    // Establish a genuinely active World view through the existing country
    // close control before measuring ambient movement and lifecycle pauses.
    await page.locator(".country-panel .panel-close").click();
    const worldSelection = { country: null, writer: null };
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBeNull();
    await page.mouse.move(0, 0);
    await expect(autoRotate).toHaveAttribute("data-globe-auto-rotate-state", "active");
    const ambientBefore = (await probe(page)).backgrounds[0].ambient;
    await expect.poll(async () => JSON.stringify((await probe(page)).backgrounds[0].ambient)).not.toBe(JSON.stringify(ambientBefore));
    await preview(page, DEFAULT);
    expect(await page.evaluate(() => window.__editionScene.active(false))).toBeGreaterThan(0);
    await expect(panel(page)).toBeHidden();
    const restoredAfterCancel = await rendered(page, LIBRARY);
    expect(restoredAfterCancel.backgrounds[0].uuid).toBe(restoredLibrary.uuid);
    await expect.poll(async () => (await probe(page)).frameloop).toBe("never");
    const paused = await probe(page);
    await liveFrames(page);
    const stillPaused = await probe(page);
    expect(stillPaused.backgrounds[0].ambient).toEqual(paused.backgrounds[0].ambient);
    expect(stillPaused.renderFrame).toBe(paused.renderFrame);
    expect(stillPaused.pose).toEqual(paused.pose);
    retained(page, stillPaused, restored, paused.pose, worldSelection);
    expect(await page.evaluate(() => window.__editionScene.active(true))).toBeGreaterThan(0);
    await page.mouse.move(0, 0);
    await expect(autoRotate).toHaveAttribute("data-globe-auto-rotate-state", "active");
    await expect.poll(async () => JSON.stringify((await probe(page)).backgrounds[0].ambient)).not.toBe(JSON.stringify(paused.backgrounds[0].ambient));
    retained(page, await rendered(page, LIBRARY), restored, undefined, worldSelection);
    expect(fixture.operations.map(call => [call.value, call.accepted])).toEqual([[LIBRARY, false], [LIBRARY, true]]);
    fixture.result.observations.push({ initial, draft, visuals, write, restored, contextRecovery, selectionPaused,
      worldSelection, restoredAfterCancel, ambientBefore, paused, stillPaused,
      nativeBackgroundCancelledDraft: true, coldRestoreThroughActualHostPreferences: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
