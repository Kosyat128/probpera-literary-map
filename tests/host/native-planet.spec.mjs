import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Actual canonical App, native adapter, providers, styles, catalog and R3F scene.
// Only the OS plugin boundary is injected. This is source/browser evidence, not
// native installation, a production artifact, purchase or child-mode evidence.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://native-planet.test";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = {
  ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".geojson": "application/geo+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2",
};
let browser, files, sourceEvidence;
const activeFixtures = new Set();

test.beforeAll(async () => {
  const memoryOutput = path.join(root, ".tmp/native-planet-memory-output");
  let viteGlobTransform;
  const result = await build({
    absWorkingDir: root,
    stdin: { resolveDir: root, sourcefile: "native-planet-test-entry.ts", loader: "ts", contents: `
      import{_roots}from'@react-three/fiber';
      import{mountHostApp}from'./src/host/mountHostApp';
      import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
      const initial=window.__nativePlanetInitial;
      const handles=[];
      let appActive=true;
      const lifecycleEvents=[];
      const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
      const bindings={
        core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
        app:{getAppLanguage:async()=>({value:initial.language==='ru'?'ru-RU':'en-US'}),getState:async()=>({isActive:appActive}),getLaunchUrl:async()=>undefined,addListener:subscribe},
        network:{getStatus:async()=>({connected:true}),addListener:subscribe},
        preferences:{get:async({key})=>({value:await window.__nativePlanetPreference('get',key)}),set:async({key,value})=>{await window.__nativePlanetPreference('set',key,value)},remove:async({key})=>{await window.__nativePlanetPreference('remove',key)}},
        browser:{open:async()=>{throw Error('External browser unavailable in the native source fixture')}},
        appLauncher:{openUrl:async()=>({completed:false})}
      };
      window.__nativePlanetHarness={
        scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,frameloop:s.frameloop}}),
        appListenerCount:()=>handles.filter(handle=>!handle.removed&&handle.event==='appStateChange').length,
        setAppActive:isActive=>{if(typeof isActive!=='boolean')throw Error('Boolean app state required');appActive=isActive;const listeners=handles.filter(handle=>!handle.removed&&handle.event==='appStateChange');lifecycleEvents.push({isActive,documentVisibility:document.visibilityState,listenerCount:listeners.length});for(const handle of listeners)handle.listener({isActive});return listeners.length},
        lifecycleEvents:()=>lifecycleEvents,
        savedLanguage:()=>window.__nativePlanetPreference('get','probpera-interface-language'),
        savedWelcome:()=>window.__nativePlanetPreference('get','probpera-planet-welcome-v1'),
        canonicalCountry:async(id)=>{const{countries}=await import('./src/data/countries');const country=countries.find(value=>value.id===id);return country?{id:country.id,writerCount:country.writers.length}:null},
        journeySeed:async(id)=>{const[{countries},{chooseRandomLiteraryDestination}]=await Promise.all([import('./src/data/countries'),import('./src/components/globeDiscovery')]);for(let i=0;i<countries.length;i++){const seed=(i+.5)/countries.length;if(chooseRandomLiteraryDestination({candidates:countries,randomValue:seed})?.id===id)return seed}throw Error('Canonical journey destination not found')},
        back:()=>{for(const h of handles)if(!h.removed&&h.event==='backButton')h.listener({canGoBack:false})}
      };
      createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__nativePlanetBootstrapError=error.message});
    ` },
    bundle: true, write: false, metafile: true, outdir: memoryOutput,
    entryNames: "native-planet", assetNames: "assets/[name]-[hash]", publicPath: "/fixture/",
    format: "iife", platform: "browser", target: "es2020", jsx: "automatic", logLevel: "silent",
    define: {
      "process.env.NODE_ENV": '"development"',
      "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false, PROD: true, VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "", VITE_TURNSTILE_SITE_KEY: "" }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: "false",
      __LITERARY_PLANET_LICENSE_AUTHORITY__: "null", __YANDEX_METRIKA_COUNTER_ID__: '""',
    },
    loader: { ".css": "css", ".png": "file", ".webp": "file", ".avif": "file", ".jpg": "file", ".jpeg": "file", ".svg": "file", ".woff": "file", ".woff2": "file" },
    plugins: [{ name: "native-planet-canonical-resource-urls", setup(builder) {
      // Faithfully expand only the two known lazy Vite glob imports. Preserve
      // primary/retry module identities; the actual Canvas source stays intact.
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await readFile(args.path, "utf8");
        const attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt);
          return `({"./BookShelfSceneCanvas.tsx": () => import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module => module.default)})`;
        });
        if (attempts.join(",") !== "primary,retry" || contents.includes("import.meta.glob")) throw Error("Unexpected canonical Vite glob imports; review the fixture transform");
        viteGlobTransform = { source: "src/components/BookShelfScene.tsx", sourceSha256: digest(source), attempts, semantics: "lazy default import with distinct primary/retry query identities" };
        return { contents, loader: "tsx", resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split("?");
        return { path: path.resolve(args.resolveDir, filename), suffix: "?" + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === "url-token" ? { path: args.path, external: true } : undefined);
      builder.onResolve({ filter: /\.geojson\?url$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "canonical-geojson-url" }));
      builder.onLoad({ filter: /.*/, namespace: "canonical-geojson-url" }, async args => ({ contents: await readFile(args.path), loader: "file" }));
    } }],
  });
  const modules = Object.keys(result.metafile.inputs).map(value => value.replaceAll("\\", "/"));
  for (const required of ["src/App.tsx", "src/host/mountHostApp.tsx", "src/components/LiteraryGlobe.tsx", "src/platform/adapters/android/AndroidPlatformAdapter.ts"]) {
    expect(modules, "The actual source module must remain in the fixture graph").toContain(required);
  }
  expect(modules.some(name => /src\/pwa\/(?:PwaEdition|qaSceneProbe|serviceWorkerRuntime)\./u.test(name))).toBe(false);
  for (const attempt of ["primary", "retry"]) expect(modules).toContain("src/components/BookShelfSceneCanvas.tsx?stage5Load=" + attempt);
  files = new Map(result.outputFiles.map(file => ["/fixture/" + path.relative(memoryOutput, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  const selection = JSON.parse(selectionBytes);
  for (const entry of selection.files) {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    const filename = path.resolve(root, entry.source);
    if (await realpath(filename) !== filename) throw Error("Linked selected native asset");
    const bytes = await readFile(filename);
    if (digest(bytes) !== entry.sourceSha256) throw Error("Stale selected native asset: " + entry.output);
    files.set("/" + entry.output, bytes);
  }
  sourceEvidence = {
    kind: "canonical-native-app-source-in-Chrome",
    nativePlugins: "injected Android OS boundary; Preferences Map persists outside each document through a Playwright binding", actualApp: true, actualCss: true,
    publicAssetSelectionSha256: digest(selectionBytes), selectedPublicAssets: selection.files.length,
    viteGlobTransform,
    bundledFiles: result.outputFiles.map(file => ({ path: path.relative(memoryOutput, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    nativeDeviceObserved: false, releaseReady: false,
  };
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });
test.afterEach(async ({}, testInfo) => {
  const multipleFixtures = activeFixtures.size > 1;
  let fixtureIndex = 0;
  for (const fixture of activeFixtures) {
    try { await captureEvidence(fixture, testInfo, "native-final-" + testInfo.status + (multipleFixtures ? "-" + (++fixtureIndex) : "")); }
    finally { await fixture.page.close(); activeFixtures.delete(fixture); }
  }
});

async function open({ route = "/", language = "ru", viewport = { width: 1280, height: 800 }, reducedMotion = "reduce", safeArea, preferences = {} } = {}) {
  const page = await browser.newPage({ viewport, reducedMotion });
  page.setDefaultTimeout(15_000);
  const errors = [], consoleErrors = [], externalRequests = [], missingResources = [];
  const preferenceMemory = new Map([["probpera-interface-language", language], ...Object.entries(preferences)]);
  const preferenceOperations = [];
  const fixture = { page, errors, consoleErrors, externalRequests, missingResources, preferenceMemory, preferenceOperations };
  activeFixtures.add(fixture);
  // Simulated OS persistence lives outside the document. Reload therefore tests
  // the real adapter's whitelist/readback and the real welcome initialization.
  await page.exposeBinding("__nativePlanetPreference", (_source, operation, key, value) => {
    preferenceOperations.push({ operation, key, ...(operation === "set" ? { value } : {}) });
    if (operation === "get") return preferenceMemory.get(key) ?? null;
    if (operation === "set") { preferenceMemory.set(key, value); return; }
    if (operation === "remove") { preferenceMemory.delete(key); return; }
    throw Error("Unknown simulated native preference operation");
  });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  if (safeArea) {
    const session = await page.context().newCDPSession(page);
    fixture.safeAreaSession = session;
    await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeArea });
  }
  await page.addInitScript(value => {
    window.__nativePlanetInitial = value;
    window.__nativePlanetVisibleHeroFrames = 0;
    window.__nativePlanetWelcomeFrames = { visible: 0, beforeRealSceneReady: 0, duringLaunch: 0, maxCanvasCount: 0 };
    window.__nativePlanetFocusTrace = [];
    const focusNode = element => {
      if (!(element instanceof Element)) return null;
      const rect = element.getBoundingClientRect();
      const hiddenAncestors = [];
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (ancestor.inert || ancestor.hidden || style.display === "none" || style.visibility === "hidden") {
          hiddenAncestors.push({ tag: ancestor.tagName, id: ancestor.id, className: ancestor.className,
            inert: ancestor.inert, hidden: ancestor.hidden, display: style.display, visibility: style.visibility });
        }
      }
      return { tag: element.tagName, id: element.id, className: element.className, connected: element.isConnected,
        action: element.getAttribute("data-atlas-action") ?? element.getAttribute("data-planet-welcome-action"),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, hiddenAncestors };
    };
    const traceFocus = (kind, target) => {
      const trace = window.__nativePlanetFocusTrace;
      if (trace.length >= 150) return;
      trace.push({ kind, at: performance.now(), target: focusNode(target), active: focusNode(document.activeElement),
        searchOpen: document.querySelector("[data-atlas-experience]")?.getAttribute("data-atlas-search-open") });
    };
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      const observed = this.matches('#country-search, [data-atlas-action="toggle-search"], [data-planet-welcome-action], .country-panel, .atlas-country-presentation');
      if (observed) traceFocus("before-focus", this);
      const result = Reflect.apply(originalFocus, this, args);
      if (observed) traceFocus("after-focus", this);
      return result;
    };
    document.addEventListener("focusin", event => traceFocus("focusin", event.target), true);
    document.addEventListener("focusout", event => traceFocus("focusout", event.target), true);
    const observe = () => {
      const hero = document.querySelector(".magazine-hero");
      if (hero) { const rect = hero.getBoundingClientRect(); const style = getComputedStyle(hero); if (rect.width && rect.height && style.display !== "none" && style.visibility !== "hidden") window.__nativePlanetVisibleHeroFrames++; }
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return Boolean(rect.width && rect.height && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
      };
      const frames = window.__nativePlanetWelcomeFrames;
      frames.maxCanvasCount = Math.max(frames.maxCanvasCount, document.querySelectorAll("canvas").length);
      if (visible(document.querySelector("[data-planet-welcome]"))) {
        frames.visible++;
        if (!document.querySelector('.native-planet-app[data-planet-ready="true"] #atlas .literary-globe[data-globe-webgl-context="ready"]')) frames.beforeRealSceneReady++;
        if (visible(document.querySelector(".native-planet-launch"))) frames.duringLaunch++;
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  }, { language });
  await page.route("**/*", async request => {
    const url = new URL(request.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await request.abort(); return; }
    if (request.request().resourceType() === "document" && url.pathname === "/") {
      await request.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="' + language + '"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/native-planet.css"></head><body><div id="root"></div><script src="/fixture/native-planet.js"></script></body></html>' });
      return;
    }
    const bytes = files.get(decodeURIComponent(url.pathname));
    if (bytes) { await request.fulfill({ contentType: mime[path.extname(url.pathname)] ?? "application/octet-stream", body: bytes }); return; }
    if (url.pathname !== "/favicon.ico") missingResources.push(url.pathname);
    await request.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture resource" });
  });
  await page.goto(origin + route);
  await nativeRootReady(page);
  return fixture;
}

async function nativeRootReady(page) {
  await expect(page.locator(".native-planet-app")).toBeVisible();
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator('#atlas .literary-globe[data-globe-webgl-context="ready"]')).toBeVisible();
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".magazine-hero")).toHaveCount(0);
}

async function captureScene(page) {
  const scene = await page.evaluateHandle(() => window.__nativePlanetHarness.scenes().find(value => document.querySelector("#atlas").contains(value.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
  return scene;
}

async function retained(page, original) {
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await original.evaluate(previous => {
    const current = window.__nativePlanetHarness.scenes().find(value => value.canvas === previous.canvas);
    return previous.canvas.isConnected && current?.renderer === previous.renderer && current?.camera === previous.camera && current?.scene === previous.scene;
  })).toBe(true);
}

async function cameraPose(original) {
  return original.evaluate(({ camera }) => ({
    position: camera.position.toArray().map(value => Number(value.toFixed(5))),
    quaternion: camera.quaternion.toArray().map(value => Number(value.toFixed(5))),
    zoom: Number(camera.zoom.toFixed(5)),
  }));
}

async function settledCameraPose(original) {
  let previous, pose, stable = 0;
  await expect.poll(async () => {
    pose = await cameraPose(original);
    const current = JSON.stringify(pose);
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    return stable;
  }, { intervals: [100, 200, 300], timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  return pose;
}

async function showWriter(page) {
  const toggle = page.locator(".atlas-country-sheet-toggle");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await expect(page.locator(".writer-detail h4")).toContainText(/Достоевск|Dostoevsk/iu);
}

async function captureEvidence(fixture, testInfo, name, extra = {}) {
  let runtime;
  try {
    runtime = await fixture.page.evaluate(() => {
      const describe = selector => [...document.querySelectorAll(selector)].map(element => ({
        tag: element.tagName, id: element.id, hidden: element.hidden,
        visible: Boolean(element.getClientRects().length) && getComputedStyle(element).visibility !== "hidden",
        attributes: Object.fromEntries([...element.attributes].filter(attribute => /^(?:data-|aria-|hidden$)/u.test(attribute.name)).map(attribute => [attribute.name, attribute.value])),
        text: element.textContent?.trim().slice(0, 2500),
      }));
      return {
        url: location.href, language: document.documentElement.lang,
        bootstrapError: window.__nativePlanetBootstrapError ?? null,
        visibleHeroFrames: window.__nativePlanetVisibleHeroFrames,
        welcomeFrames: window.__nativePlanetWelcomeFrames,
        quietLanguageAccess: window.__nativePlanetQuietLanguageAccess ?? [],
        focusTrace: window.__nativePlanetFocusTrace,
        finalActiveElement: { tag: document.activeElement?.tagName, id: document.activeElement?.id,
          action: document.activeElement?.getAttribute("data-atlas-action") },
        journeyRandomInput: window.__nativePlanetJourneyRandom ?? null,
        nativeLifecycleEvents: window.__nativePlanetHarness?.lifecycleEvents() ?? [],
        canvasCount: document.querySelectorAll("#atlas canvas").length,
        documentCanvasCount: document.querySelectorAll("canvas").length,
        native: describe(".native-planet-app, .native-planet-launch, .native-planet-panel"),
        welcome: describe("[data-planet-welcome]"),
        archive: describe("#books, #book-archive-detail, .stage5-deferred-books, [data-requested-book], #books [role=status], #books [role=alert]"),
      };
    });
  } catch (error) { runtime = { diagnosticError: error.message }; }
  await testInfo.attach(name, { body: JSON.stringify({ ...sourceEvidence, ...extra, runtime,
    simulatedNativePreferences: Object.fromEntries(fixture.preferenceMemory), preferenceOperations: fixture.preferenceOperations,
    errors: fixture.errors, consoleErrors: fixture.consoleErrors, externalRequests: fixture.externalRequests, missingResources: fixture.missingResources }), contentType: "application/json" });
  try {
    const screenshotPath = testInfo.outputPath(name + ".png");
    await fixture.page.screenshot({ path: screenshotPath, timeout: 10_000 });
    await testInfo.attach(name + "-screenshot", { path: screenshotPath, contentType: "image/png" });
  } catch (error) { await testInfo.attach(name + "-screenshot-error", { body: error.message, contentType: "text/plain" }); }
}

async function evidence(fixture, testInfo, name, extra = {}) {
  await captureEvidence(fixture, testInfo, name, extra);
  expect(await fixture.page.evaluate(() => window.__nativePlanetBootstrapError ?? null)).toBeNull();
  expect(fixture.errors).toEqual([]);
  expect(fixture.externalRequests).toEqual([]);
  expect(fixture.missingResources).toEqual([]);
  expect(await fixture.page.evaluate(() => window.__nativePlanetVisibleHeroFrames)).toBe(0);
}

test("native first screen is the actual immersive globe and RU/EN retains writer and scene", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas" });
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
    await showWriter(page);
    await expect(page.locator("[data-planet-welcome]")).toHaveCount(0);
    const selectedCameraPose = await settledCameraPose(original);
    for (const language of ["en", "ru"]) {
      await page.locator(".native-planet-app .interface-language-control button").filter({ hasText: language.toUpperCase() }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe(language);
      await retained(page, original);
      expect(await cameraPose(original)).toEqual(selectedCameraPose);
      await showWriter(page);
      const url = new URL(page.url());
      expect(url.searchParams.get("country")).toBe("russia");
      expect(url.searchParams.get("writer")).toBe("dostoevsky");
      await evidence(fixture, testInfo, "native-entry-" + language, { locales: ["ru", "en", "ru"], selectedCountry: "russia", selectedWriter: "dostoevsky", sameCanvasRendererCameraScene: true, cameraPose: selectedCameraPose, cameraPoseDecimalPrecision: 5 });
    }
  } finally { await original.dispose(); }
});

async function nativeGlobeRuntime(page) {
  return page.evaluate(() => {
    const current = window.__nativePlanetHarness.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
    return { documentVisibility: document.visibilityState, frameloop: current.frameloop,
      renderFrame: current.renderer.info.render.frame, autoRotate: current.controls?.autoRotate,
      controlsEnabled: current.controls?.enabled };
  });
}

async function backgroundFrameEvidence(page) {
  const samples = await page.evaluate(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    // Allow the committed R3F mode change to consume pending browser work, then
    // observe real renderer counters while document animation frames still run.
    await frame(); await frame();
    const samples = [];
    for (let index = 0; index < 18; index++) {
      const at = await frame();
      const current = window.__nativePlanetHarness.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
      samples.push({ at, documentVisibility: document.visibilityState, frameloop: current.frameloop,
        renderFrame: current.renderer.info.render.frame, autoRotate: current.controls?.autoRotate,
        controlsEnabled: current.controls?.enabled,
        cameraPosition: current.camera.position.toArray().map(value => Number(value.toFixed(5))),
        cameraQuaternion: current.camera.quaternion.toArray().map(value => Number(value.toFixed(5))) });
    }
    return samples;
  });
  expect(samples).toHaveLength(18);
  expect(samples.at(-1).at).toBeGreaterThan(samples[0].at);
  expect(samples.every(sample => sample.documentVisibility === "visible" && sample.frameloop === "never" &&
    sample.autoRotate === false && sample.controlsEnabled === false)).toBe(true);
  expect(new Set(samples.map(sample => sample.renderFrame)).size).toBe(1);
  expect(new Set(samples.map(sample => JSON.stringify([sample.cameraPosition, sample.cameraQuaternion]))).size).toBe(1);
  return samples;
}

test("native host background pauses the actual globe while the document stays visible and resumes preserved state", async ({}, testInfo) => {
  const fixture = await open({ reducedMotion: "no-preference", preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  const original = await captureScene(page);
  const globe = page.locator("#atlas .literary-globe");
  try {
    await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.appListenerCount())).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "active");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "active");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).autoRotate).toBe(true);
    const initial = await nativeGlobeRuntime(page);
    expect(initial.documentVisibility).toBe("visible");
    expect(initial.frameloop).toBe("always");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).renderFrame).toBeGreaterThan(initial.renderFrame);

    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(false))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "paused");
    await expect(globe).toHaveAttribute("data-globe-frame-mode", "never");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "document-hidden");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).frameloop).toBe("never");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).controlsEnabled).toBe(false);
    const automaticBackground = await backgroundFrameEvidence(page);
    await retained(page, original);
    await evidence(fixture, testInfo, "native-host-background", { initial, automaticBackground,
      nativeLifecycleFixture: "Injected App appStateChange; actual document remains visible and browser RAF continues",
      batteryOrDeviceMeasurement: false });

    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(true))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "active");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "active");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).autoRotate).toBe(true);
    await expect.poll(async () => (await nativeGlobeRuntime(page)).renderFrame).toBeGreaterThan(automaticBackground.at(-1).renderFrame);
    await retained(page, original);

    // Select an existing canonical writer through the real UI, then preserve
    // that selection, locale and reduced-motion preference across another cycle.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator("#country-search").fill("Достоевский");
    await page.locator('#country-results [role="option"]').filter({ hasText: /Ф[её]дор.*Достоевск/iu }).first().click();
    await showWriter(page);
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await page.locator(".native-planet-app .interface-language-control button").filter({ hasText: "EN" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe("en");
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "reduced-motion");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).frameloop).toBe("demand");
    const selectedPose = await settledCameraPose(original);
    const selectedUrl = page.url();

    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(false))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "paused");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).frameloop).toBe("never");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).controlsEnabled).toBe(false);
    const selectedBackground = await backgroundFrameEvidence(page);
    expect(await cameraPose(original)).toEqual(selectedPose);
    expect(page.url()).toBe(selectedUrl);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(true))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "active");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "reduced-motion");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).frameloop).toBe("demand");
    expect((await nativeGlobeRuntime(page)).autoRotate).toBe(false);
    expect((await nativeGlobeRuntime(page)).controlsEnabled).toBe(true);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    expect(page.url()).toBe(selectedUrl);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await showWriter(page);
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(selectedPose);
    await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.appListenerCount())).toBe(1);
    await evidence(fixture, testInfo, "native-host-resumed-en-selection", { selectedBackground, selectedPose,
      selectedCountry: "russia", selectedWriter: "dostoevsky", locale: "en", reducedMotion: true,
      sameCanvasRendererCameraScene: true, nativeLifecycleFixture: "Two injected OS lifecycle cycles with real App/R3F behavior",
      batteryOrDeviceMeasurement: false });
  } finally { await original.dispose(); }
});

async function welcomeGeometry(page, safeArea = { top: 0, bottom: 0, left: 0, right: 0 }) {
  const card = page.locator("[data-planet-welcome]");
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox(), viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(safeArea.left);
  expect(bounds.y).toBeGreaterThanOrEqual(safeArea.top);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - safeArea.right);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - safeArea.bottom);
  const header = await page.locator(".atlas-immersive-chrome").boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(header.y + header.height);
  const buttons = [];
  for (const button of await card.getByRole("button").all()) {
    const buttonBounds = await button.boundingBox();
    expect(buttonBounds.width).toBeGreaterThanOrEqual(44);
    expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
    buttons.push({ action: await button.getAttribute("data-planet-welcome-action"), bounds: buttonBounds });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  return { viewport, safeArea, card: bounds, header, buttons };
}

async function welcomeLanguageAccess(page, safeArea) {
  // Observe the application's own idle timer without pointer/focus actions or
  // synthetic quiet attributes: language must stay discoverable while reading.
  await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-quiet", "true");
  await expect(page.locator("[data-planet-welcome]")).toBeVisible();
  const chrome = page.locator(".atlas-immersive-chrome");
  await expect(chrome).toHaveCSS("opacity", "1");
  await expect(chrome).toHaveCSS("transform", "none");
  expect(await chrome.evaluate(element => element.matches(":hover, :focus-within"))).toBe(false);
  const buttons = chrome.locator(".interface-language-control button");
  await expect(buttons).toHaveText(["RU", "EN"]);
  const observations = [];
  for (const button of await buttons.all()) {
    await expect(button).toBeVisible();
    const observation = await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      let effectiveOpacity = 1;
      const clippingAncestors = [];
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        effectiveOpacity *= Number(style.opacity);
        if ([style.overflowX, style.overflowY].some(value => /^(hidden|clip|scroll|auto)$/u.test(value))) {
          clippingAncestors.push({ tag: ancestor.tagName, className: ancestor.className,
            bounds: ancestor.getBoundingClientRect().toJSON(), clientWidth: ancestor.clientWidth,
            clientHeight: ancestor.clientHeight, overflowX: style.overflowX, overflowY: style.overflowY,
            borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth });
        }
      }
      const result = { language: element.textContent, bounds: rect.toJSON(), effectiveOpacity,
        hitTarget: hit === element || element.contains(hit), clippingAncestors };
      (window.__nativePlanetQuietLanguageAccess ??= []).push({ viewport: { width: innerWidth, height: innerHeight }, ...result });
      return result;
    });
    await expect(button).toBeInViewport({ ratio: 1 });
    expect(observation.effectiveOpacity).toBe(1);
    expect(observation.hitTarget).toBe(true);
    expect(observation.bounds.width).toBeGreaterThanOrEqual(44);
    expect(observation.bounds.height).toBeGreaterThanOrEqual(44);
    expect(observation.bounds.x).toBeGreaterThanOrEqual(safeArea.left);
    expect(observation.bounds.y).toBeGreaterThanOrEqual(safeArea.top);
    expect(observation.bounds.right).toBeLessThanOrEqual(page.viewportSize().width - safeArea.right);
    expect(observation.bounds.bottom).toBeLessThanOrEqual(page.viewportSize().height - safeArea.bottom);
    observations.push(observation);
  }
  return { quiet: true, naturalIdleObserved: true, hoveredOrFocused: false,
    chromeOpacity: 1, chromeTransform: "none", buttons: observations };
}

test("first journey invitation waits for the real scene, keeps RU/EN camera pose and starts a canonical journey", async ({}, testInfo) => {
  const fixture = await open();
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    const invitation = page.locator("[data-planet-welcome]");
    await expect(invitation.getByRole("heading", { name: "Начните путешествие", exact: true })).toBeVisible();
    const pose = await settledCameraPose(original);
    const invitationNode = await invitation.elementHandle();
    for (const [language, phase] of [["ru", "ru-initial"], ["en", "en"], ["ru", "ru-restored"]]) {
      if (await page.locator("html").getAttribute("lang") !== language) {
        await page.locator(".atlas-immersive-chrome .interface-language-control button").filter({ hasText: language.toUpperCase() }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(invitation.getByRole("heading", { name: language === "ru" ? "Начните путешествие" : "Begin your journey", exact: true })).toBeVisible();
      expect(await invitationNode.evaluate(originalNode => originalNode === document.querySelector("[data-planet-welcome]"))).toBe(true);
      await retained(page, original);
      expect(await cameraPose(original)).toEqual(pose);
      expect(new URL(page.url()).searchParams.get("country")).toBeNull();
      const frames = await page.evaluate(() => window.__nativePlanetWelcomeFrames);
      expect(frames.visible).toBeGreaterThan(0);
      expect(frames.beforeRealSceneReady).toBe(0);
      expect(frames.duringLaunch).toBe(0);
      expect(frames.maxCanvasCount).toBe(1);
      await evidence(fixture, testInfo, "native-welcome-" + phase, { welcomeGeometry: await welcomeGeometry(page),
        sameCanvasRendererCameraScene: true, unchangedCameraPose: pose, simulatedNativePreferences: true });
    }
    // Reproducible input to the existing random picker, computed from that
    // actual picker and current canonical catalogue. No replacement selection
    // function or invented country is injected. Math.random is replaced only
    // for the explicit click dispatch and restored after its first use.
    const seed = await page.evaluate(() => window.__nativePlanetHarness.journeySeed("russia"));
    await page.evaluate(value => {
      const button = document.querySelector('[data-planet-welcome-action="journey"]');
      button.addEventListener("click", () => {
        const originalRandom = Math.random;
        const observation = window.__nativePlanetJourneyRandom = { seed: value, calls: 0, restored: false };
        const restore = () => { Math.random = originalRandom; observation.restored = true; };
        Math.random = () => { observation.calls++; restore(); return value; };
        // Native browser dispatch may checkpoint microtasks before React's
        // delegated bubble listener. A next-task fallback keeps the one-call
        // seam scoped to this click; the picker itself restores immediately.
        setTimeout(restore, 0);
      }, { once: true, capture: true });
    }, seed);
    await invitation.locator('[data-planet-welcome-action="journey"]').click();
    await expect(invitation).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
    const canonical = await page.evaluate(() => window.__nativePlanetHarness.canonicalCountry("russia"));
    expect(canonical.id).toBe("russia");
    expect(canonical.writerCount).toBeGreaterThan(0);
    const destination = page.locator('.atlas-country-presentation[data-atlas-country="russia"]');
    await expect(destination).toBeVisible();
    await expect(destination).toHaveAccessibleName("Россия");
    await expect(destination).toBeFocused();
    await expect(destination.locator(".country-panel:not(.panel-loading)")).toBeVisible();
    await expect(destination).toBeFocused();
    await retained(page, original);
    const destinationPose = await settledCameraPose(original);
    expect(destinationPose).not.toEqual(pose);
    await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedWelcome())).toBe("completed");
    const randomObservation = await page.evaluate(() => window.__nativePlanetJourneyRandom);
    expect(randomObservation).toEqual({ seed, calls: 1, restored: true });
    await evidence(fixture, testInfo, "native-welcome-journey-completed", { canonicalDestination: canonical,
      randomInputFixture: randomObservation, originalCameraPose: pose, destinationCameraPose: destinationPose,
      sameCanvasRendererCameraScene: true, nativeOsPersistenceObserved: false });
    await invitationNode.dispose();
  } finally { await original.dispose(); }
});

test("first journey on narrow reduced-motion screens supports keyboard search, remembered completion and fresh deep links", async ({}, testInfo) => {
  const safeArea = { top: 59, bottom: 34, left: 0, right: 0 };
  const fixture = await open({ viewport: { width: 320, height: 844 }, reducedMotion: "reduce", safeArea });
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    const invitation = page.locator("[data-planet-welcome]");
    await expect(invitation).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const sizes = [];
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      sizes.push({ ...await welcomeGeometry(page, safeArea), languageAccess: await welcomeLanguageAccess(page, safeArea) });
      await retained(page, original);
    }
    const pose = await settledCameraPose(original);
    await evidence(fixture, testInfo, "native-welcome-narrow-ru", { layouts: sizes, reducedMotion: true,
      safeAreaEmulation: "Chrome CDP CSS environment, not an iOS/Android device" });
    await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
    await evidence(fixture, testInfo, "native-welcome-narrow-large-text", { layout: await welcomeGeometry(page, safeArea),
      textScaleFixture: "CSS root font size 125%; not an OS accessibility-setting observation" });
    const landscapeArea = { top: 0, bottom: 21, left: 44, right: 44 };
    await fixture.safeAreaSession.send("Emulation.setSafeAreaInsetsOverride", { insets: landscapeArea });
    await page.setViewportSize({ width: 844, height: 390 });
    await invitation.locator('[data-planet-welcome-action="journey"]').focus();
    await page.keyboard.press("Tab");
    const search = invitation.locator('[data-planet-welcome-action="search"]');
    await expect(search).toBeFocused();
    await expect(search).toBeInViewport({ ratio: 1 });
    expect(await search.evaluate(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return hit === element || element.contains(hit);
    })).toBe(true);
    await retained(page, original);
    await evidence(fixture, testInfo, "native-welcome-landscape-keyboard-search", { layout: await welcomeGeometry(page, landscapeArea),
      textScaleFixture: 1.25, keyboardFocus: "Tab from canonical journey action to search", sameCanvasRendererCameraScene: true });
    await page.keyboard.press("Enter");
    await expect(invitation).toHaveCount(0);
    await expect(page.locator("#country-search")).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedWelcome())).toBe("completed");
    await retained(page, original);
    expect(new URL(page.url()).searchParams.get("country")).toBeNull();
    await page.locator("#country-search").fill("Достоевский");
    await expect(page.locator('#country-results [role="option"]').filter({ hasText: /Ф[её]дор.*Достоевск/iu }).first()).toBeVisible();
    await expect(page.locator("#country-search")).toBeFocused();
    await evidence(fixture, testInfo, "native-welcome-keyboard-search-ready", { query: "Достоевский",
      realCanonicalWriterResult: true, searchInputFocused: true, sameCanvasRendererCameraScene: true });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture.safeAreaSession.send("Emulation.setSafeAreaInsetsOverride", { insets: safeArea });
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(pose);
    await page.reload();
    await nativeRootReady(page);
    await expect(invitation).toHaveCount(0);
    expect(await page.evaluate(() => window.__nativePlanetWelcomeFrames.visible)).toBe(0);
    expect(fixture.preferenceMemory.get("probpera-planet-welcome-v1")).toBe("completed");
    await evidence(fixture, testInfo, "native-welcome-completed-reload", { persistedThrough: "Simulated OS Preferences Map outside the document",
      firstJourneyRepeated: false, nativeOsPersistenceObserved: false });
  } finally { await original.dispose(); }
  // A separate first-use preference store prevents completed state from hiding
  // a broken deep-link priority rule. The actual canonical writer is retained.
  const incoming = await open({ route: "/?country=russia&writer=dostoevsky#atlas", viewport: { width: 390, height: 844 }, reducedMotion: "reduce", safeArea });
  await showWriter(incoming.page);
  await expect(incoming.page.locator("[data-planet-welcome]")).toHaveCount(0);
  expect(await incoming.page.evaluate(() => window.__nativePlanetWelcomeFrames.visible)).toBe(0);
  expect(incoming.preferenceMemory.has("probpera-planet-welcome-v1")).toBe(false);
  await evidence(incoming, testInfo, "native-welcome-fresh-deep-link", { selectedCountry: "russia", selectedWriter: "dostoevsky",
    freshWelcomePreference: true, deepLinkTookPriority: true });
});

test("opening and closing a canonical work returns to the same native globe", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas" });
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    await showWriter(page);
    await page.locator("#writer-biography-russia-tab-works").click();
    await page.locator("#writer-biography-russia-panel-works").getByRole("button", { name: "Книжный архив: Преступление и наказание", exact: true }).click();
    await expect(page.locator("#book-archive-detail")).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe("russia:dostoevsky:crime-and-punishment");
    await retained(page, original);
    await captureEvidence(fixture, testInfo, "native-work-open");
    await page.locator(".native-planet-panel .book-detail-close").click();
    await expect(page.locator("#book-archive-detail")).toBeHidden();
    await expect(page.locator(".native-planet-panel")).toBeVisible();
    await page.locator(".native-planet-panel").getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(page.locator(".native-planet-panel")).toBeHidden();
    await retained(page, original);
    await expect(page.locator("#atlas")).toBeVisible();
    await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
    await showWriter(page);
    await page.locator("#writer-biography-russia-tab-works").click();
    await page.locator("#writer-biography-russia-panel-works").getByRole("button", { name: "Книжный архив: Преступление и наказание", exact: true }).click();
    await expect(page.locator("#book-archive-detail")).toBeVisible();
    await page.locator(".native-planet-panel").getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(page.locator("#book-archive-detail")).toBeHidden();
    await expect(page.locator(".native-planet-panel")).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
    await retained(page, original);
    await showWriter(page);
    await evidence(fixture, testInfo, "native-work-return", { selectedWork: "russia:dostoevsky:crime-and-punishment", sameCanvasRendererCameraScene: true, closeFlows: ["detail then collection", "top return while detail open"] });
  } finally { await original.dispose(); }
});

test("narrow reduced-motion native launch and search retain the actual globe without a homepage flash", async ({}, testInfo) => {
  const safeArea = { top: 59, bottom: 34, left: 0, right: 0 };
  const fixture = await open({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", safeArea });
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
    const box = await page.locator("#atlas canvas").boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(380);
    expect(box.height).toBeGreaterThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const compactChrome = [];
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await retained(page, original);
      const logo = page.locator(".atlas-immersive-chrome .atlas-immersive-identity > img");
      await expect(logo).toBeVisible();
      expect(await logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      const logoBounds = await logo.boundingBox();
      expect(logoBounds.width).toBe(24);
      expect(logoBounds.height).toBe(24);
      expect(logoBounds.y).toBeGreaterThanOrEqual(safeArea.top);
      expect(logoBounds.x).toBeGreaterThanOrEqual(safeArea.left);
      const headerButtons = page.locator(".atlas-immersive-chrome button:visible");
      expect(await headerButtons.count()).toBeGreaterThan(0);
      const buttons = [];
      for (const button of await headerButtons.all()) {
        const bounds = await button.boundingBox();
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.y).toBeGreaterThanOrEqual(safeArea.top);
        expect(bounds.x).toBeGreaterThanOrEqual(safeArea.left);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - safeArea.right);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(844 - safeArea.bottom);
        if (buttons.length) expect(Math.abs(bounds.y - buttons[0].y)).toBeLessThanOrEqual(2);
        buttons.push(bounds);
      }
      expect(logoBounds.x + logoBounds.width).toBeLessThanOrEqual(Math.min(...buttons.map(bounds => bounds.x)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      compactChrome.push({ width, logo: logoBounds, buttons });
    }
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator("#country-search").fill("Достоевский");
    await page.locator('#country-results [role="option"]').filter({ hasText: /Ф[её]дор.*Достоевск/iu }).first().click();
    await showWriter(page);
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await retained(page, original);
    await evidence(fixture, testInfo, "native-narrow-reduced-motion", { viewport: { width: 390, height: 844 }, reducedMotion: true, directGlobeEntry: true, safeArea, compactChrome, sameCanvasAcrossResize: true, safeAreaEmulation: "Chrome CDP CSS environment; not an iOS device" });
    await page.locator('[data-atlas-action="open-collection"]').click();
    const returnButton = page.locator(".native-planet-panel").getByRole("button", { name: "Вернуться к планете", exact: true });
    await expect(returnButton).toBeVisible();
    const closeBounds = await returnButton.boundingBox();
    expect(closeBounds.y).toBeGreaterThanOrEqual(safeArea.top);
    expect(closeBounds.x + closeBounds.width).toBeLessThanOrEqual(390 - safeArea.right);
    expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(844 - safeArea.bottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await retained(page, original);
    await evidence(fixture, testInfo, "native-narrow-collection-safe-area", { safeArea, safeAreaEmulation: "Chrome CDP CSS environment; not an iOS device" });
  } finally { await original.dispose(); }
});
