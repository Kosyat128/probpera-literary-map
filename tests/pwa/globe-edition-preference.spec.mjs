import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Actual App, native source entry, CSS, country data, textures and R3F scene.
// Native OS plugins and edition PreferenceStore are controlled ports. This is
// source/Chrome evidence, not an installed device or durable native IO claim.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://globe-edition-preference.test";
const KEY = "probpera.globe-edition.v2", LEGACY = "probpera.globe-style.v1";
const ANTIQUE = "rand-mcnally-1887", EARTH = "nasa-blue-marble", MODERN = "natural-earth-2026";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-edition-preference-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const subscribe=async()=>({async remove(){}});
    const bindings={
      core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:true}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),set:async({key,value})=>{await window.__osPreference('set',key,value)},remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},
      appLauncher:{openUrl:async()=>({completed:false})}
    };
    window.__editionScene={scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,frameloop:s.frameloop}})};
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(({services,initialization})=>{
      const actual=services.preferences,editionKey=key=>key==='probpera.globe-edition.v2'||key==='probpera.globe-style.v1';
      const preferences=Object.freeze({persistence:actual.persistence,
        get:key=>editionKey(key)?window.__editionPreference('get',key):actual.get(key),
        set:(key,value)=>editionKey(key)?window.__editionPreference('set',key,value):actual.set(key,value),
        remove:key=>editionKey(key)?window.__editionPreference('remove',key):actual.remove(key)});
      mountHostApp({services:Object.freeze({...services,preferences}),initialization});
    }).catch(error=>{window.__editionBootstrapError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "edition-preference", assetNames: "assets/[name]-[hash]",
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
    "src/components/GlobeCameraRig.tsx", "src/components/globeAtlas.ts", "src/host/PlanetEditionPreferenceStatus.tsx"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-edition-preference-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins", "edition PreferenceStore with explicit false save results and held reads"],
    preferenceBacking: "Node-owned map survives document reload; not native durable-storage acceptance",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

async function open(testInfo, { failSave = false, holdRead = false, stored = ANTIQUE } = {}) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-browser"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "ep-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"], [KEY, stored]]);
  const state = { failSave, holdRead }, operations = [], pending = [], errors = [], externalRequests = [], missingResources = [], assets = [];
  const result = { ...sourceEvidence, pass: false, observations: [] };
  page.on("pageerror", error => errors.push(error.message));
  await page.exposeBinding("__osPreference", (_source, operation, key, value) => {
    if (operation === "get") return memory.get(key) ?? null;
    if (operation === "set") { memory.set(key, value); return; }
    if (operation === "remove") { memory.delete(key); return; }
    throw Error("Unknown OS fixture preference operation");
  });
  await page.exposeBinding("__editionPreference", (_source, operation, key, value) => {
    if (key !== KEY && key !== LEGACY) throw Error("Unexpected controlled edition key");
    const call = { operation, key, ...(value === undefined ? {} : { value }), at: Date.now() }; operations.push(call);
    if (operation === "get") {
      const captured = memory.get(key) ?? null;
      if (key === KEY && state.holdRead) return new Promise(resolve => pending.push(() => {
        call.settledAt = Date.now(); call.delivered = captured; resolve(captured);
      }));
      call.delivered = captured; return captured;
    }
    if (operation === "set") {
      call.accepted = !state.failSave;
      if (state.failSave) return false;
      memory.set(key, value); return true;
    }
    if (operation === "remove") { memory.delete(key); return true; }
    throw Error("Unknown edition fixture operation");
  });
  await page.addInitScript(() => {
    // Cold-start restoration must use PreferenceStore rather than a Web mirror.
    localStorage.removeItem("probpera.globe-edition.v2"); localStorage.removeItem("probpera.globe-style.v1");
    window.__editionTransitions = [];
    new MutationObserver(records => {
      for (const record of records) if (record.type === "attributes" && record.attributeName === "data-globe-edition") {
        window.__editionTransitions.push({ edition: record.target.getAttribute("data-globe-edition"), at: performance.now() });
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-globe-edition"] });
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === "document" && url.pathname === "/") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/edition-preference.css"></head><body><div id="root"></div><script src="/fixture/edition-preference.js"></script></body></html>' }); return;
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
      if (selectedAssets.has(pathname)) assets.push(pathname);
      await route.fulfill({ contentType: mime[path.extname(pathname)] ?? "application/octet-stream", body: bytes }); return;
    }
    if (pathname !== "/favicon.ico") missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture asset" });
  });
  try {
    await page.goto(origin + "/?country=russia&writer=dostoevsky#atlas");
    await ready(page);
    return { page, state, memory, operations, pending, result,
      releaseReads() { state.holdRead = false; pending.splice(0).forEach(resolve => resolve()); },
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true; },
      async close() {
        state.holdRead = false; pending.splice(0).forEach(resolve => resolve());
        result.preferenceOperations = operations; result.textureRequests = [...new Set(assets.filter(asset => asset.startsWith("/textures/")))];
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        result.transitions = await page.evaluate(() => window.__editionTransitions);
        await fs.writeFile(testInfo.outputPath("globe-edition-preference.json"), JSON.stringify(result, null, 2) + "\n");
        await context.close();
      } };
  } catch (error) { state.holdRead = false; pending.splice(0).forEach(resolve => resolve()); await context.close(); throw error; }
}

const globe = page => page.locator("#atlas .literary-globe");
const status = page => page.locator("[data-planet-edition-save-state]");
async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(globe(page)).toHaveAttribute("data-globe-webgl-context", "ready");
  await expect(globe(page)).toHaveAttribute("data-globe-camera-phase", "idle");
  await expect(page.locator("canvas")).toHaveCount(1);
  const sheet = page.locator(".atlas-country-sheet-toggle");
  if (await sheet.isVisible() && await sheet.getAttribute("aria-expanded") === "false") await sheet.click();
  await expect(page.locator(".writer-detail h4")).toContainText(/Достоевск|Dostoevsk/iu);
  expect(await page.evaluate(() => window.__editionBootstrapError ?? null)).toBeNull();
}
async function captureScene(page) {
  const scene = await page.evaluateHandle(() => window.__editionScene.scenes().find(value => document.querySelector("#atlas").contains(value.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.renderer && value.camera && value.scene))).toBe(true);
  return scene;
}
async function snapshot(scene) {
  return scene.evaluate(({ renderer, camera, scene }) => {
    const surfaces = [];
    scene.traverse(object => { if (object.isMesh && object.geometry?.type === "SphereGeometry" && object.geometry.parameters.radius === 1
      && object.material?.isMeshPhysicalMaterial && object.material.map?.isCanvasTexture) surfaces.push(object.material.map); });
    if (surfaces.length !== 1) throw Error("Expected exactly one actual globe map texture");
    const map = surfaces[0], thumb = document.createElement("canvas"); thumb.width = 64; thumb.height = 32;
    const context = thumb.getContext("2d"); context.drawImage(map.image, 0, 0, thumb.width, thumb.height);
    const pixels = context.getImageData(0, 0, thumb.width, thumb.height).data;
    let fingerprint = 2166136261; for (const byte of pixels) fingerprint = Math.imul(fingerprint ^ byte, 16777619);
    // Installed Three WebGLTextures.js tracks completed uploads with __version.
    // Read the existing resource; do not change or inject a renderer/texture.
    const gpu = renderer.properties.get(map);
    return { pose: { position: camera.position.toArray().map(value => Number(value.toFixed(5))),
      quaternion: camera.quaternion.toArray().map(value => Number(value.toFixed(5))), zoom: Number(camera.zoom.toFixed(5)) },
      texture: { uuid: map.uuid, version: map.version, uploadedVersion: gpu.__version ?? null,
        gpuAllocated: !!gpu.__webglTexture, width: map.image.width, height: map.image.height, fingerprint: (fingerprint >>> 0).toString(16) } };
  });
}
async function settledSnapshot(scene) {
  let previous, current, stable = 0;
  await expect.poll(async () => {
    current = await snapshot(scene);
    const signature = JSON.stringify(current.pose);
    stable = signature === previous ? stable + 1 : 0; previous = signature;
    return stable >= 3 && current.texture.gpuAllocated && current.texture.uploadedVersion === current.texture.version;
  }, { intervals: [100, 200, 300], timeout: 15_000 }).toBe(true);
  return current;
}
async function retained(page, original, pose) {
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await original.evaluate(previous => {
    const current = window.__editionScene.scenes().find(value => value.canvas === previous.canvas);
    return previous.canvas.isConnected && current?.renderer === previous.renderer && current?.camera === previous.camera && current?.scene === previous.scene;
  })).toBe(true);
  if (pose) expect((await settledSnapshot(original)).pose).toEqual(pose);
  expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
}
async function choose(page, edition) {
  const select = page.locator(".globe-edition-compact-select select");
  if (await select.isVisible()) await select.selectOption(edition);
  else {
    const option = page.locator('button[data-globe-edition-option="' + edition + '"]');
    if (!await option.isVisible()) await page.locator('[data-globe-control="edition-rail-toggle"]').click();
    await option.click();
  }
}
async function rendered(page, edition) {
  await expect(globe(page)).toHaveAttribute("data-globe-edition", edition);
  await expect(globe(page)).toHaveAttribute("data-globe-edition-transition", "idle");
  await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", edition);
}
async function language(page, locale) {
  const menu = page.locator('.native-planet-app [data-atlas-action="toggle-menu"]');
  if (await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  const control = page.locator(`.native-planet-app [data-atlas-application-menu-panel] [data-interface-language="${locale}"]`);
  await expect(control).toBeVisible(); await control.click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function mobileNotice(page, testInfo, width, locale) {
  await page.setViewportSize({ width, height: 844 }); await language(page, locale);
  await expect(status(page)).toHaveAttribute("data-planet-edition-save-state", "failed");
  const geometry = await status(page).evaluate(node => {
    const rect = node.getBoundingClientRect(), button = node.querySelector("button").getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: innerWidth, scroll: node.scrollWidth, client: node.clientWidth,
      buttonHeight: button.height, buttonWidth: button.width };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(width);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
  expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44); expect(geometry.buttonWidth).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath("edition-save-failed-" + locale + "-" + width + ".png") });
  return geometry;
}

test("failed edition saving retains the actual scene and texture, offers RUEN retry, and restores the saved edition after cold reload", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { failSave: true }), { page } = fixture;
  const original = await captureScene(page);
  let cold;
  try {
    await rendered(page, ANTIQUE);
    const initial = await settledSnapshot(original);
    await choose(page, EARTH); await rendered(page, EARTH);
    await expect(status(page)).toHaveAttribute("data-planet-edition-save-state", "failed");
    const selected = await settledSnapshot(original);
    expect(selected.texture.fingerprint).not.toBe(initial.texture.fingerprint);
    expect(selected.texture.uuid).toBe(initial.texture.uuid);
    expect(fixture.memory.get(KEY)).toBe(ANTIQUE);
    await expect(status(page).getByRole("status")).toHaveText("Не удалось подтвердить сохранение. Выбранный глобус остаётся на экране, но при следующем запуске выбор может сброситься.");
    await expect(status(page).getByRole("button", { name: "Повторить сохранение", exact: true })).toBeVisible();
    await retained(page, original, initial.pose);
    await language(page, "en");
    await expect(status(page).getByRole("status")).toHaveText("Saving could not be confirmed. Your selected globe stays on screen, but your choice may reset the next time you open the app.");
    await expect(status(page).getByRole("button", { name: "Try saving again", exact: true })).toBeVisible();
    await retained(page, original, initial.pose);
    expect((await snapshot(original)).texture.fingerprint).toBe(selected.texture.fingerprint);
    const mobile = [];
    for (const [width, locale] of [[390, "en"], [320, "ru"]]) {
      mobile.push({ width, locale, geometry: await mobileNotice(page, testInfo, width, locale) });
      // Responsive framing may change the pose; ownership must remain stable.
      await retained(page, original);
      expect((await snapshot(original)).texture.fingerprint).toBe(selected.texture.fingerprint);
    }
    await page.setViewportSize({ width: 1440, height: 850 }); await language(page, "en");
    const beforeRetry = await settledSnapshot(original);
    fixture.state.failSave = false;
    const retry = status(page).getByRole("button", { name: "Try saving again", exact: true });
    await retry.focus(); await retry.press("Enter");
    await expect(status(page)).toHaveAttribute("data-planet-edition-save-state", "idle");
    await expect.poll(() => fixture.memory.get(KEY)).toBe(EARTH);
    expect(await page.evaluate(() => document.activeElement?.closest(".literary-globe") !== null)).toBe(true);
    await retained(page, original, beforeRetry.pose);
    expect((await snapshot(original)).texture.fingerprint).toBe(selected.texture.fingerprint);
    fixture.result.observations.push({ phase: "failed-save-and-retry", initial, selected, beforeRetry, mobile,
      sameCanvasRendererCameraScene: true, country: "russia", writer: "dostoevsky" });
    await page.reload(); await ready(page); await rendered(page, EARTH);
    cold = await captureScene(page);
    const restored = await settledSnapshot(cold);
    expect(restored.texture.fingerprint).toBe(selected.texture.fingerprint);
    await expect(status(page)).toHaveAttribute("data-planet-edition-save-state", "idle");
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    expect(fixture.operations.filter(call => call.operation === "set" && call.key === KEY && call.value === EARTH).map(call => call.accepted)).toEqual([false, true]);
    fixture.result.observations.push({ phase: "cold-reload", restored, preferenceReadThroughControlledStore: true });
    await page.screenshot({ path: testInfo.outputPath("edition-restored-cold.png") });
    fixture.verify();
  } finally { await original.dispose(); await cold?.dispose(); await fixture.close(); }
});

test("late preference hydration cannot replace an explicit edition choice in the persistent canonical scene", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, { holdRead: true, stored: EARTH }), { page } = fixture;
  const original = await captureScene(page);
  try {
    await rendered(page, ANTIQUE);
    const initial = await settledSnapshot(original);
    expect(fixture.pending.length).toBeGreaterThan(0);
    const boundary = await page.evaluate(() => window.__editionTransitions.length);
    await choose(page, MODERN);
    // Deliver immediately after the real click has registered newer intent,
    // while the requested texture may still be loading.
    fixture.releaseReads();
    await rendered(page, MODERN);
    await expect(status(page)).toHaveAttribute("data-planet-edition-save-state", "idle");
    await expect.poll(() => fixture.memory.get(KEY)).toBe(MODERN);
    await retained(page, original, initial.pose);
    const selected = await settledSnapshot(original);
    expect(selected.texture.fingerprint).not.toBe(initial.texture.fingerprint);
    const changes = await page.evaluate(boundary => window.__editionTransitions.slice(boundary), boundary);
    expect(changes.some(change => change.edition === EARTH), "No intermediate rendered restoration of an obsolete preference").toBe(false);
    expect(fixture.operations.some(call => call.operation === "get" && call.key === KEY && call.delivered === EARTH && call.settledAt)).toBe(true);
    expect(fixture.operations.filter(call => call.operation === "set" && call.key === KEY).every(call => call.value === MODERN)).toBe(true);
    fixture.result.observations.push({ phase: "stale-hydration-after-choice", initial, selected, changes,
      sameCanvasRendererCameraScene: true, country: "russia", writer: "dostoevsky" });
    await page.screenshot({ path: testInfo.outputPath("edition-explicit-choice-retained.png") });
    fixture.verify();
  } finally { await original.dispose(); await fixture.close(); }
});
