import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Real native entry, App/providers, CSS and R3F scene. Only the OS language,
// lifecycle and preference plugins are controlled; this is not a device test.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://native-foreground-language.test";
const LANGUAGE_KEY = "probpera-interface-language", COMPOSITION_KEY = "probpera-planet-composition-v1";
const selection = { editionId: "rand-mcnally-1887", standId: "stand.base.wood", backgroundId: "background.base.site-starfield" };
const composition = JSON.stringify({ schemaVersion: 1, commitId: "foreground-language-fixture:1", selection });
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/native-foreground-language-memory");
  const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: "ts", contents: `
    import{_roots}from'@react-three/fiber';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true;
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={
      core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:()=>window.__osLanguage(),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>({connected:true,connectionType:'wifi'}),addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),set:async({key,value})=>{await window.__osPreference('set',key,value)},remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},
      appLauncher:{openUrl:async()=>({completed:false})}
    };
    window.__foreground={scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene}}),
      active:value=>{active=value;const current=handles.filter(handle=>!handle.removed&&handle.event==='appStateChange');for(const handle of current)handle.listener({isActive:value});return current.length}};
    createAndroidPlatformAdapter({bindings,channel:'dev',timeoutMs:5000}).then(initialized=>{
      window.__foreground.platform=()=>({snapshot:initialized.services.getSnapshot(),languages:initialized.services.getSystemLanguages()});
      mountHostApp(initialized);
    }).catch(error=>{window.__foregroundBootstrapError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "foreground-language", assetNames: "assets/[name]-[hash]",
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
  const required = ["src/App.tsx", "src/host/mountHostApp.tsx", "src/host/HostRuntimeStatus.tsx", "src/host/HostPlatformServices.ts",
    "src/host/initializeHostPlatform.ts", "src/platform/adapters/android/AndroidPlatformAdapter.ts", "src/i18n/InterfaceLanguage.tsx",
    "src/components/InterfaceLanguageControl.tsx", "src/components/LiteraryGlobe.tsx", "src/components/GlobeCameraRig.tsx",
    "src/components/globeAtlas.ts", "src/host/planetComposition.ts", "src/components/useGlobeCompositionFrame.ts"];
  for (const module of required) expect(inputs, "Actual source must remain in the App graph").toContain(module);
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-foreground-language-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native App language and lifecycle", "native Preferences backed by a Node-owned map"],
    languageReadTimeoutMs: 5000, installedNative: false, releaseReady: false,
    sourceInputs: await Promise.all(required.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(root, filename))) }))),
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })) };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S04_BROWSER_PROFILE_ROOT ?? process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s04-foreground-language"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "fl-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-planet-welcome-v1", "completed"], [COMPOSITION_KEY, composition]]);
  const state = { language: "ru-RU", holdNext: false }, operations = [], reads = [], held = [];
  const errors = [], externalRequests = [], missingResources = [];
  const result = { ...sourceEvidence, pass: false, observations: [],
    limitations: ["Actual App in Chrome with controlled native OS ports, not an installed Android test.",
      "Reload reuses a Node-owned preference map and intercepted local assets; it does not prove native durable storage or built-PWA offline behavior."] };
  const release = () => { for (const resolve of held.splice(0)) resolve(); };
  page.on("pageerror", error => errors.push(error.message));
  await page.exposeBinding("__osLanguage", () => {
    const value = state.language, call = { value, held: state.holdNext, delivered: false }; reads.push(call);
    const deliver = () => { call.delivered = true; return { value }; };
    if (state.holdNext) { state.holdNext = false; return new Promise(resolve => held.push(() => resolve(deliver()))); }
    return deliver();
  });
  await page.exposeBinding("__osPreference", (_source, operation, key, value) => {
    operations.push({ operation, key, ...(value === undefined ? {} : { value }) });
    if (operation === "get") return memory.get(key) ?? null;
    if (operation === "set") { memory.set(key, value); return; }
    if (operation === "remove") { memory.delete(key); return; }
    throw Error("Unknown native preference fixture operation");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === "document" && url.pathname === "/") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/foreground-language.css"></head><body><div id="root"></div><script src="/fixture/foreground-language.js"></script></body></html>' }); return;
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
    return { page, memory, state, reads, operations, result, release,
      // Opening the deep-linked writer legitimately records Recent history.
      // Keep that operation in evidence; this assertion covers other preferences.
      writes: () => operations.filter(operation => operation.operation !== "get" && operation.key !== "probpera-planet-recent-adult-v1"),
      verify() { expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true; },
      async close() {
        release(); result.languageReads = reads; result.preferenceOperations = operations;
        result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
        const filename = testInfo.outputPath("native-foreground-language.json");
        await fs.writeFile(filename, JSON.stringify(result, null, 2) + "\n");
        await testInfo.attach("foreground-language-source-evidence", { path: filename, contentType: "application/json" });
        await context.close();
      } };
  } catch (error) { release(); await context.close(); throw error; }
}

async function ready(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready");
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
  await expect(page.locator("canvas")).toHaveCount(1);
  const sheet = page.locator(".atlas-country-sheet-toggle");
  if (await sheet.isVisible() && await sheet.getAttribute("aria-expanded") === "false") await sheet.click();
  await expect(page.locator(".writer-detail h4")).toContainText(/Достоевск|Dostoevsk/iu);
  expect(await page.evaluate(() => window.__foregroundBootstrapError ?? null)).toBeNull();
}
async function locale(page, language) {
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page).toHaveTitle(language === "ru" ? "Литературная планета" : "Literary Planet");
  await expect(page.locator(".native-planet-app .interface-language-control button").filter({ hasText: language === "ru" ? /^RU$/u : /^EN$/u })).toHaveAttribute("aria-pressed", "true");
}
const platform = page => page.evaluate(() => window.__foreground.platform());
async function sample(page, remember = false) {
  return page.evaluate(remember => {
    const current = window.__foreground.scenes().find(value => document.querySelector("#atlas")?.contains(value.canvas));
    if (!current) return null;
    if (remember) window.__foregroundOriginal = current;
    const original = window.__foregroundOriginal, surfaces = [], stands = [];
    current.scene.traverse(object => {
      if (object.name.startsWith("included-globe-stand:")) stands.push(object);
      if (object.isMesh && object.geometry?.type === "SphereGeometry" && object.geometry.parameters.radius === 1
        && object.material?.isMeshPhysicalMaterial && object.material.map?.isCanvasTexture) surfaces.push(object);
    });
    const surface = surfaces[0], map = surface?.material.map, gpu = map && current.renderer.properties.get(map);
    const globe = document.querySelector("#atlas .literary-globe");
    return { language: document.documentElement.lang, title: document.title, url: location.href,
      selection: { editionId: globe.getAttribute("data-globe-edition"), standId: stands[0]?.userData.standId,
        backgroundId: globe.getAttribute("data-globe-background") },
      sameScene: !!original && current.canvas === original.canvas && current.canvas.isConnected && current.renderer === original.renderer
        && current.camera === original.camera && current.scene === original.scene,
      surfaceCount: surfaces.length, standCount: stands.length, standResource: stands[0]?.uuid,
      geometry: surface?.geometry.uuid, texture: map?.uuid, uploaded: !!gpu?.__webglTexture && gpu.__version === map?.version,
      frame: current.renderer.info.render.frame, contextLost: current.renderer.getContext().isContextLost(),
      pose: { position: current.camera.position.toArray().map(n => Number(n.toFixed(5))),
        quaternion: current.camera.quaternion.toArray().map(n => Number(n.toFixed(5))), zoom: current.camera.zoom },
      platform: window.__foreground.platform() };
  }, remember);
}
async function stable(page) {
  let previous, current, matches = 0;
  await expect.poll(async () => {
    current = await sample(page);
    if (!current?.uploaded || JSON.stringify(current.selection) !== JSON.stringify(selection)) return false;
    const key = JSON.stringify(current.pose); matches = key === previous ? matches + 1 : 0; previous = key;
    return matches >= 3;
  }, { intervals: [80, 150, 250] }).toBe(true);
  return current;
}
async function retained(fixture, baseline, label) {
  const current = await stable(fixture.page);
  expect(current.sameScene).toBe(true); expect(current.pose).toEqual(baseline.pose); expect(current.url).toBe(baseline.url);
  expect(current.texture).toBe(baseline.texture); expect(current.geometry).toBe(baseline.geometry);
  expect(current.standResource).toBe(baseline.standResource);
  expect(current.surfaceCount).toBe(1); expect(current.standCount).toBe(1); expect(current.contextLost).toBe(false);
  expect(current.frame).toBeGreaterThan(0); expect(fixture.memory.get(COMPOSITION_KEY)).toBe(composition);
  await expect(fixture.page.locator("canvas")).toHaveCount(1);
  fixture.result.observations.push({ label, ...current }); return current;
}
async function resume(fixture, value, hold = false) {
  const { page, state, reads } = fixture, count = reads.length;
  expect(await page.evaluate(() => window.__foreground.active(false))).toBeGreaterThan(0);
  await expect.poll(async () => (await platform(page)).snapshot.visibility).toBe("background");
  state.language = value; state.holdNext = hold;
  expect(await page.evaluate(() => window.__foreground.active(true))).toBeGreaterThan(0);
  await expect.poll(() => reads.length).toBe(count + 1);
  await expect.poll(async () => (await platform(page)).snapshot.visibility).toBe("active");
}
const drain = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test("foreground OS locale follows confirmed absence while explicit and saved choices retain the live scene", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page, memory, result } = fixture;
  try {
    await locale(page, "ru"); expect(memory.has(LANGUAGE_KEY)).toBe(false);
    await sample(page, true); const baseline = await stable(page);
    expect(baseline.platform.languages).toEqual(["ru-RU"]); expect(fixture.writes()).toEqual([]);
    result.observations.push({ label: "absent-preference-russian-bootstrap", ...baseline });

    await resume(fixture, "en-US"); await locale(page, "en");
    await expect.poll(async () => (await platform(page)).languages).toEqual(["en-US"]);
    await retained(fixture, baseline, "foreground-system-english"); expect(fixture.writes()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("foreground-system-en-1440.png") });

    await resume(fixture, 17); await expect.poll(() => fixture.reads.at(-1).delivered).toBe(true); await drain(page);
    await locale(page, "en"); expect((await platform(page)).languages).toEqual(["en-US"]);
    await retained(fixture, baseline, "invalid-system-result-retains-english"); expect(fixture.writes()).toEqual([]);

    // Return automatically to RU so the held EN response really changes the
    // source locale; reaffirming RU is an explicit user action even when active.
    await resume(fixture, "ru-RU"); await locale(page, "ru"); expect(fixture.writes()).toEqual([]);
    await resume(fixture, "en-US", true); expect(fixture.reads.at(-1).delivered).toBe(false);
    await page.locator(".native-planet-app .interface-language-control button").filter({ hasText: /^RU$/u }).click();
    await expect.poll(() => memory.get(LANGUAGE_KEY)).toBe("ru");
    fixture.release(); await expect.poll(async () => (await platform(page)).languages).toEqual(["en-US"]);
    await locale(page, "ru"); await retained(fixture, baseline, "explicit-russian-wins-late-system-english");
    expect(fixture.writes()).toEqual([{ operation: "set", key: LANGUAGE_KEY, value: "ru" }]);
    await page.screenshot({ path: testInfo.outputPath("foreground-explicit-ru-1440.png") });

    await page.reload(); await ready(page); await locale(page, "ru");
    const restored = await stable(page);
    expect(restored.platform.languages).toEqual(["en-US"]); expect(restored.url).toBe(baseline.url);
    expect(restored.selection).toEqual(selection); expect(memory.get(COMPOSITION_KEY)).toBe(composition);
    // Object identities are intentionally not compared across a new document.
    result.observations.push({ label: "saved-russian-cold-mount-with-system-english", ...restored });
    expect(fixture.writes()).toEqual([{ operation: "set", key: LANGUAGE_KEY, value: "ru" }]);
    fixture.verify();
  } finally { await fixture.close(); }
});
