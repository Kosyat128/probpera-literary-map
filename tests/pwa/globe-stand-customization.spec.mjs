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
const origin = "https://globe-stand-customization.test";
const ANTIQUE = "rand-mcnally-1887";
const KEY = "probpera-planet-stand-v1";
const MUSEUM = "stand.base.museum", WOOD = "stand.base.wood", BOOKS = "stand.base.book-stack";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-stand-customization-memory");
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
        if(key==='probpera-planet-stand-v1')(window.__standWrites??=[]).push({value,observed:window.__standProbe?.sample()??null});
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
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "stand-customization", assetNames: "assets/[name]-[hash]",
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
    "src/components/globeStandGeometry.ts", "src/host/PlanetStandControls.tsx"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-stand-customization-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins, including explicit stand-preference set failure"],
    observation: "Actual stand bounds, geometry/material disposal and globe raycasting; no production probes",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

async function open(testInfo, { failSave = false } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-stand-customization"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "sc-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"]]);
  const state = { failSave }, operations = [], errors = [], externalRequests = [], missingResources = [];
  const result = { ...sourceEvidence, pass: false, observations: [], installedNative: false,
    limitations: ["Three adult included stands only; no child, rights/release or all-composition acceptance.",
      "Disposal evidence covers observed stand geometries/materials; global renderer counts are diagnostics."] };
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__standUiTrace = [];
    new MutationObserver(() => {
      const panel = document.querySelector("[data-planet-stand-panel]");
      if (!panel) return;
      const scene = window.__editionScene?.scenes().find(value => document.querySelector("#atlas")?.contains(value.canvas));
      const row = { phase: panel.getAttribute("data-planet-stand-phase"),
        choice: panel.querySelector("[data-planet-stand-select]")?.value,
        applyDisabled: panel.querySelector("[data-planet-stand-apply]")?.disabled,
        frame: scene?.renderer.info.render.frame ?? null };
      const previous = window.__standUiTrace[window.__standUiTrace.length - 1];
      if (!previous || previous.phase !== row.phase || previous.choice !== row.choice || previous.applyDisabled !== row.applyDisabled) {
        window.__standUiTrace.push(row);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-planet-stand-phase", "disabled"] });
  });
  await page.exposeBinding("__osPreference", (_source, operation, key, value) => {
    if (operation === "get") return memory.get(key) ?? null;
    if (operation === "set") {
      if (key === KEY) {
        operations.push({ operation, key, value, accepted: !state.failSave });
        if (state.failSave) throw Error("Controlled native stand save failure");
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
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/stand-customization.css"></head><body><div id="root"></div><script src="/fixture/stand-customization.js"></script></body></html>' }); return;
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
        result.lastScene = await page.evaluate(() => window.__standProbe?.sample() ?? null);
        result.disposalLedger = await page.evaluate(() => window.__standProbe?.ledger() ?? []);
        result.preferenceWritesAtRender = await page.evaluate(() => window.__standWrites ?? []);
        result.uiRenderTrace = await page.evaluate(() => window.__standUiTrace ?? []);
        result.preferenceOperations = operations; result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        await fs.writeFile(testInfo.outputPath("globe-stand-customization.json"), JSON.stringify(result, null, 2) + "\n");
        await page.evaluate(() => window.__standProbe?.disconnect()); await context.close();
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
    const resources = new Map(); let current = new Set();
    function watch(object, kind, standId) {
      if (!resources.has(object.uuid)) {
        const row = { object, kind, standId, disposals: 0, listener: () => { row.disposals++; } };
        object.addEventListener("dispose", row.listener); resources.set(object.uuid, row);
      }
    }
    const ledger = () => [...resources].map(([uuid, row]) => ({ uuid, kind: row.kind, standId: row.standId,
      current: current.has(uuid), disposals: row.disposals }));
    const sample = () => {
      const scene = window.__editionScene.scenes().find(value => value.canvas === original.canvas);
      const groups = [], globes = []; let canonicalFrameRings = 0;
      original.scene.traverse(object => {
        if (object.name.startsWith("included-globe-stand:")) groups.push(object);
        if (object.geometry?.type === "TorusGeometry" && object.geometry.parameters.radius === 1.09
          && object.geometry.parameters.tube === 0.014) canonicalFrameRings++;
        if (object.isMesh && object.geometry?.type === "SphereGeometry" && object.geometry.parameters.radius === 1
          && object.material?.isMeshPhysicalMaterial && object.material.map?.isCanvasTexture) globes.push(object);
      });
      if (groups.length > 1 || globes.length !== 1) throw Error("Expected one stand slot and one canonical globe surface");
      current = new Set(); const stands = [];
      for (const group of groups) {
        const inverse = new Matrix4().copy(group.matrixWorld).invert(), box = { minimum: [Infinity, Infinity, Infinity], maximum: [-Infinity, -Infinity, -Infinity], maxRadius: 0 };
        const meshes = [], geometries = new Set(), materials = new Set();
        let triangles = 0, bytes = 0, interceptedRays = 0;
        group.traverse(object => {
          if (!object.isMesh) return; meshes.push(object);
          const geometry = object.geometry, position = geometry.getAttribute("position"), transform = new Matrix4().multiplyMatrices(inverse, object.matrixWorld);
          for (let index = 0; index < position.count; index++) {
            const point = new Vector3().fromBufferAttribute(position, index).applyMatrix4(transform);
            const xyz = point.toArray();
            xyz.forEach((value, axis) => { box.minimum[axis] = Math.min(box.minimum[axis], value); box.maximum[axis] = Math.max(box.maximum[axis], value); });
            box.maxRadius = Math.max(box.maxRadius, Math.hypot(point.x, point.z));
          }
          triangles += (geometry.index?.count ?? position.count) / 3;
          if (!geometries.has(geometry)) {
            geometries.add(geometry); watch(geometry, "geometry", group.userData.standId); current.add(geometry.uuid);
            bytes += Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (geometry.index?.array.byteLength ?? 0);
          }
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material); watch(material, "material", group.userData.standId); current.add(material.uuid);
          }
          // Fire real Three rays toward every stand mesh. Its non-pickable
          // render geometry must not intercept the globe's pointer surface.
          const ray = new Raycaster();
          const target = new Vector3().setFromMatrixPosition(object.matrixWorld);
          ray.set(original.camera.position.clone(), target.sub(original.camera.position).normalize());
          interceptedRays += ray.intersectObject(object, false).length;
        });
        stands.push({ id: group.userData.standId, provenance: group.userData.provenance, qualityTier: group.userData.qualityTier,
          meshes: meshes.length, geometries: geometries.size, materials: materials.size, triangles, bytes, box, interceptedRays });
      }
      const surface = globes[0], map = surface.material.map;
      const center = new Vector3().setFromMatrixPosition(surface.matrixWorld).project(original.camera);
      const ray = new Raycaster(); ray.setFromCamera(new Vector2(center.x, center.y), original.camera);
      const globeHits = ray.intersectObject(surface, false);
      const info = original.renderer.info;
      return { sameScene: original.canvas.isConnected && scene?.renderer === original.renderer && scene?.camera === original.camera && scene?.scene === original.scene,
        pose: { position: original.camera.position.toArray().map(value => Number(value.toFixed(5))),
          quaternion: original.camera.quaternion.toArray().map(value => Number(value.toFixed(5))), zoom: original.camera.zoom },
        globeSurface: { geometry: surface.geometry.uuid, texture: map.uuid, width: map.image.width, height: map.image.height,
          raycastHits: globeHits.length, uv: globeHits[0]?.uv?.toArray() ?? null },
        stands, canonicalFrameRings, pendingDisposals: ledger().filter(row => !row.current && row.disposals !== 1).length,
        rendererDiagnostic: { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
          calls: info.render.calls, triangles: info.render.triangles, frame: info.render.frame } };
    };
    window.__standProbe = { sample, ledger, disconnect() {
      for (const row of resources.values()) row.object.removeEventListener("dispose", row.listener);
      resources.clear();
    } };
  });
}
const panel = page => page.locator("[data-planet-stand-panel]");
const probe = page => page.evaluate(() => window.__standProbe.sample());
async function settled(page, id = "canonical") {
  let snapshot;
  await expect.poll(async () => {
    snapshot = await probe(page);
    return (id === "canonical" ? snapshot.stands.length === 0 : snapshot.stands.length === 1 && snapshot.stands[0].id === id)
      && snapshot.pendingDisposals === 0;
  }, { intervals: [50, 100, 200], timeout: 8_000 }).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  snapshot = await probe(page);
  expect(snapshot.canonicalFrameRings).toBe(id === "canonical" ? 1 : 0);
  for (const stand of snapshot.stands) {
    expect(stand.provenance).toBe("authored-in-project"); expect(stand.meshes).toBeGreaterThan(0);
    expect(stand.bytes).toBeGreaterThan(0); expect(stand.triangles).toBeGreaterThan(0);
    expect(stand.box.minimum[1]).toBeGreaterThanOrEqual(-1.44001);
    expect(stand.box.maximum[1]).toBeLessThanOrEqual(-1.02999);
    expect(stand.box.maxRadius).toBeLessThanOrEqual(0.55001);
    expect(stand.interceptedRays).toBe(0);
  }
  return snapshot;
}
async function stablePose(page) {
  let before, value, count = 0;
  await expect.poll(async () => {
    value = (await probe(page)).pose; const key = JSON.stringify(value);
    count = key === before ? count + 1 : 0; before = key; return count;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
  return value;
}
function retained(page, snapshot, original, pose) {
  expect(snapshot.sameScene).toBe(true);
  expect(snapshot.globeSurface.geometry).toBe(original.globeSurface.geometry);
  expect(snapshot.globeSurface.texture).toBe(original.globeSurface.texture);
  expect(snapshot.globeSurface.raycastHits).toBeGreaterThan(0);
  if (pose) expect(snapshot.pose).toEqual(pose);
  expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
}
async function show(page) {
  if (!await panel(page).isVisible()) await page.locator("[data-planet-stand-toggle]").click();
  await expect(panel(page)).toBeVisible();
  expect(await panel(page).getAttribute("aria-modal")).not.toBe("true");
}
async function preview(page, id) {
  await show(page); await panel(page).locator("[data-planet-stand-select]").selectOption(id);
  const actual = await settled(page, id);
  await expect(panel(page).locator("[data-planet-stand-apply]")).toBeEnabled();
  return actual;
}
async function language(page, locale) {
  const menu = page.locator('.native-planet-app [data-atlas-action="toggle-menu"]');
  if (await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  const control = page.locator(`.native-planet-app [data-atlas-application-menu-panel] [data-interface-language="${locale}"]`);
  await expect(control).toBeVisible(); await control.click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function dragPlanet(page) {
  const point = await page.locator("#atlas canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    for (const fx of [.24, .34, .44]) for (const fy of [.32, .42, .52]) {
      const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
      if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x + 60, y + 15) === canvas) return { x, y };
    }
    throw Error("Nonmodal stand controls leave no tested canvas drag area");
  });
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 60, point.y + 15, { steps: 8 }); await page.mouse.up();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
}

test("stand previews preserve the canonical globe, allow rotation, retain locale draft, and cancel through button, Escape and native Back", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page } = fixture;
  try {
    const initial = await settled(page), pose = await stablePose(page);
    const wood = await preview(page, WOOD); retained(page, wood, initial, pose);
    expect(fixture.operations).toEqual([]);
    await dragPlanet(page); const rotated = await stablePose(page);
    expect(rotated).not.toEqual(pose);
    await language(page, "en");
    await expect(panel(page).locator("[data-planet-stand-select]")).toHaveValue(WOOD);
    retained(page, await settled(page, WOOD), initial, rotated);
    await panel(page).locator("[data-planet-stand-cancel]").click();
    await expect(panel(page)).toBeHidden(); retained(page, await settled(page), initial, rotated);
    await preview(page, MUSEUM); await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden(); retained(page, await settled(page), initial, rotated);
    await preview(page, BOOKS);
    expect(await page.evaluate(() => window.__editionScene.back())).toBeGreaterThan(0);
    await expect(panel(page)).toBeHidden(); retained(page, await settled(page), initial, rotated);
    expect(fixture.operations).toEqual([]); expect(fixture.memory.has(KEY)).toBe(false);
    fixture.result.observations.push({ initial, wood, rotated, cancellation: ["button", "Escape", "native Back"], noPreviewWrites: true });
    await page.screenshot({ path: testInfo.outputPath("stand-preview-cancelled.png") });
    fixture.verify();
  } finally { await fixture.close(); }
});

test("opening collection or search and native background cancel stand drafts without committing or replacing the scene", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page } = fixture;
  try {
    const initial = await settled(page), pose = await stablePose(page);
    await preview(page, MUSEUM);
    await page.locator('[data-atlas-action="open-collection"]').click();
    await expect(page.locator(".native-planet-panel")).toBeVisible();
    await expect(panel(page)).toBeHidden(); retained(page, await settled(page), initial, pose);
    await page.locator(".native-planet-panel").getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(page.locator(".native-planet-panel")).toBeHidden();
    await preview(page, BOOKS);
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await expect(panel(page)).toBeHidden(); await expect(page.locator("#country-search")).toBeVisible();
    retained(page, await settled(page), initial, pose); await page.keyboard.press("Escape");
    await preview(page, WOOD);
    expect(await page.evaluate(() => window.__editionScene.active(false))).toBeGreaterThan(0);
    await expect(panel(page)).toBeHidden();
    // Background disables the scene loop; cancellation/disposal is a React
    // lifecycle action and does not require forcing a WebGL render.
    await expect.poll(async () => { const state = await probe(page); return state.stands.length === 0 && state.pendingDisposals === 0; }).toBe(true);
    expect(await page.evaluate(() => window.__editionScene.active(true))).toBeGreaterThan(0);
    retained(page, await settled(page), initial, pose);
    expect(fixture.operations).toEqual([]); expect(fixture.memory.has(KEY)).toBe(false);
    fixture.result.observations.push({ initial, cancellation: ["collection", "search", "native background"], noPreviewWrites: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test("Apply waits for a rendered stand, failed persistence keeps it applied, RUEN mobile retry succeeds and cold reload restores it", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { failSave: true }), { page } = fixture;
  try {
    const initial = await settled(page), pose = await stablePose(page);
    const draft = await preview(page, BOOKS); retained(page, draft, initial, pose);
    expect(fixture.operations).toEqual([]);
    const trace = await page.evaluate(() => window.__standUiTrace.filter(row => row.choice === "stand.base.book-stack"));
    const preparing = trace.find(row => row.phase === "preparing"), acknowledged = trace.find(row => row.phase === "preview");
    expect(preparing).toMatchObject({ applyDisabled: true });
    expect(acknowledged).toMatchObject({ applyDisabled: false });
    expect(acknowledged.frame).toBeGreaterThan(preparing.frame);
    await panel(page).locator("[data-planet-stand-apply]").click();
    await expect(page.locator('[data-planet-stand-save-state="failed"]')).toBeVisible();
    retained(page, await settled(page, BOOKS), initial, pose);
    expect(fixture.memory.has(KEY)).toBe(false);
    const write = await page.evaluate(() => window.__standWrites[0]);
    expect(write.value).toBe(BOOKS); expect(write.observed.stands[0].id).toBe(BOOKS);
    expect(write.observed.rendererDiagnostic.frame).toBeGreaterThan(initial.rendererDiagnostic.frame);
    const visuals = [];
    await page.setViewportSize({ width: 320, height: 844 });
    for (const locale of ["ru", "en"]) {
      await language(page, locale);
      await expect(panel(page)).toBeVisible();
      const retry = panel(page).locator("[data-planet-stand-save-retry]");
      await expect(retry).toHaveText(locale === "ru" ? "Повторить сохранение" : "Try saving again");
      const geometry = await panel(page).evaluate(element => {
        const rect = element.getBoundingClientRect(), controls = [...element.querySelectorAll("button,select")].filter(node => node.getClientRects().length);
        return { x: rect.x, right: rect.right, scroll: element.scrollWidth, client: element.clientWidth,
          controls: controls.map(node => ({ height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right })) };
      });
      expect(geometry.x).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(320);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      for (const control of geometry.controls) { expect(control.height).toBeGreaterThanOrEqual(44); expect(control.right).toBeLessThanOrEqual(320); }
      retained(page, await settled(page, BOOKS), initial);
      visuals.push({ locale, width: 320, geometry });
      await page.screenshot({ path: testInfo.outputPath("stand-save-failed-" + locale + "-320.png") });
    }
    fixture.state.failSave = false;
    const retry = panel(page).locator("[data-planet-stand-save-retry]"); await retry.focus(); await retry.press("Enter");
    await expect.poll(() => fixture.memory.get(KEY)).toBe(BOOKS);
    await expect(page.locator('[data-planet-stand-save-state="failed"]')).toHaveCount(0);
    const applied = await settled(page, BOOKS);
    const appliedResources = await page.evaluate(() => window.__standProbe.ledger().filter(row => row.current));
    expect(appliedResources.some(row => row.kind === "geometry")).toBe(true);
    expect(appliedResources.some(row => row.kind === "material")).toBe(true);
    for (const resource of appliedResources) expect(resource).toMatchObject({ standId: BOOKS, disposals: 0 });
    await panel(page).locator("[data-planet-stand-select]").selectOption(WOOD);
    await expect(panel(page)).toHaveAttribute("data-planet-stand-phase", "preview");
    // The applied stand stays detached and alive while another draft is
    // shown. Its intentional retention is not an outstanding disposal.
    await expect.poll(async () => (await probe(page)).stands.map(stand => stand.id)).toEqual([WOOD]);
    const retainedDraft = await probe(page);
    const draftResources = await page.evaluate(() => window.__standProbe.ledger());
    const appliedIds = new Set(appliedResources.map(resource => resource.uuid));
    expect(draftResources.filter(resource => appliedIds.has(resource.uuid))).toEqual(
      appliedResources.map(resource => ({ ...resource, current: false })),
    );
    retained(page, retainedDraft, initial);
    await panel(page).locator("[data-planet-stand-cancel]").click();
    await expect(panel(page)).toBeHidden(); retained(page, await settled(page, BOOKS), initial);
    const cancelledResources = await page.evaluate(() => window.__standProbe.ledger().filter(row => row.current));
    expect(cancelledResources).toEqual(appliedResources);
    const beforeReload = await probe(page);
    fixture.result.observations.push({ initial, draft, beforeReload, visuals, applyAfterObservedRender: write,
      retainedAppliedBaseline: { applied, appliedResources, retainedDraft, draftResources, cancelledResources } });
    await page.setViewportSize({ width: 1440, height: 850 });
    await page.reload(); await ready(page); await installProbe(page);
    const restored = await settled(page, BOOKS);
    expect(restored.stands[0].bytes).toBe(draft.stands[0].bytes);
    expect(restored.stands[0].triangles).toBe(draft.stands[0].triangles);
    for (const bound of ["minimum", "maximum"]) restored.stands[0].box[bound].forEach((value, index) =>
      expect(value).toBeCloseTo(draft.stands[0].box[bound][index], 6));
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(fixture.operations.map(call => [call.value, call.accepted])).toEqual([[BOOKS, false], [BOOKS, true]]);
    fixture.result.observations.push({ restored, coldReloadThroughActualHostPreferences: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
