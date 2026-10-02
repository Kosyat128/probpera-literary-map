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
  ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".geojson": "application/geo+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2",
};
let browser, files, sourceEvidence;
const observeSearchFocus = process.env.NATIVE_PLANET_SEARCH_FOCUS_DIAGNOSTICS === "1";
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
        canonicalBookAliasAudit:async()=>{const[{countries},{buildPublicBookArchive},{getEvidenceBackedOppositeLocaleBookTitleAliases:aliases}]=await Promise.all([import('./src/data/countries'),import('./src/data/bookArchive'),import('./src/data/bookSearchAliases')]);const books=buildPublicBookArchive(countries);let ruAliasCount=0,enAliasCount=0,bothLocales=0;const samples=[];for(const book of books){const ru=aliases(book,'ru'),en=aliases(book,'en');ruAliasCount+=ru.length;enAliasCount+=en.length;if(ru.length&&en.length){bothLocales++;if(samples.length<4)samples.push({key:[book.countryId,book.writerId,book.id].join(':'),ru:book.translations.ru.title,en:book.translations.en.title,queryInRu:ru,queryInEn:en})}}return{publicBooks:books.length,ruAliasCount,enAliasCount,bothLocales,samples}},
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
      if (observeSearchFocus) builder.onLoad({ filter: /[\\/]WriterPanel\.tsx$/ }, async args => {
        const source = await readFile(args.path, "utf8");
        const anchor = 'const focusVisibleDetail = () => {';
        expect(source.split(anchor)).toHaveLength(2);
        const probe = `
          const traceFocusRequest = (point, extra = {}) => {
            const log = window.__nativePlanetWriterFocusDiagnostics ||= [];
            if (log.length < 100) log.push({ point, at: performance.now(), focusRequestId, handled: handledFocusRequest.current,
              writer: activeWriter?.id, applicationRoot, cancelled, connected: detail.isConnected,
              sameDetail: detailRef.current === detail, blockedBy: (() => { const node = detail.closest('[inert], [hidden], [aria-hidden="true"]');
                return node ? {tag:node.tagName,id:node.id,className:node.className,inert:node.inert,hidden:node.hidden,ariaHidden:node.getAttribute('aria-hidden')} : null })(), ...extra });
          };
          traceFocusRequest('frame');
        `;
        const contents = source.replace(anchor, probe + anchor + "traceFocusRequest('focus-attempt');")
          .replace('const style = window.getComputedStyle(detail);', "const style = window.getComputedStyle(detail); traceFocusRequest('computed-style', {visibility:style.visibility,display:style.display,rects:detail.getClientRects().length});")
          .replace('if (visibilityTransitions.size) {', "traceFocusRequest('transitions', {count:visibilityTransitions.size}); if (visibilityTransitions.size) {");
        return { contents, loader: "tsx", resolveDir: path.dirname(args.path) };
      });
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
    searchFocusDiagnostics: observeSearchFocus ? "Fixture-only WriterPanel observations; no application source mutation, extra pre-guard style read or altered focus control flow" : null,
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

async function open({ route = "/", language = "ru", viewport = { width: 1280, height: 800 }, reducedMotion = "reduce", safeArea, preferences = {}, hasTouch = false, isMobile = false, observeSheetGesture = false, deviceScaleFactor = 1, capabilityHints, indexedDBAvailable = true } = {}) {
  const page = await browser.newPage({ viewport, reducedMotion, hasTouch, isMobile, deviceScaleFactor });
  page.setDefaultTimeout(15_000);
  const errors = [], consoleErrors = [], externalRequests = [], missingResources = [];
  const preferenceMemory = new Map([["probpera-interface-language", language], ...Object.entries(preferences)]);
  const preferenceOperations = [];
  const fixture = { page, errors, consoleErrors, externalRequests, missingResources, preferenceMemory, preferenceOperations,
    browserCapabilities: { hasTouch, isMobile, reducedMotion, deviceScaleFactor, ...(capabilityHints ? { simulatedCapabilityHints: capabilityHints } : {}), ...(indexedDBAvailable ? {} : { indexedDBAvailable: false }) } };
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
    if (value.indexedDBAvailable === false) {
      // Browser capability failure only; the canonical storage implementation
      // must choose its own fallback. Existing cases retain real IndexedDB.
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    }
    if (value.capabilityHints) {
      for (const name of ["deviceMemory", "hardwareConcurrency"]) {
        Object.defineProperty(navigator, name, { configurable: true, get: () => value.capabilityHints[name] });
      }
      if (navigator.connection) {
        Object.defineProperty(navigator.connection, "saveData", { configurable: true, get: () => value.capabilityHints.saveData });
      } else {
        Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: value.capabilityHints.saveData } });
      }
    }
    window.__nativePlanetInitial = value;
    window.__nativePlanetVisibleHeroFrames = 0;
    window.__nativePlanetWelcomeFrames = { visible: 0, beforeRealSceneReady: 0, duringLaunch: 0, maxCanvasCount: 0 };
    window.__nativePlanetFocusTrace = [];
    window.__nativePlanetSheetEvents = [];
    window.__nativePlanetSheetMeasurements = [];
    if (value.observeSheetGesture) {
      let handlePointer = null;
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture", "click"]) {
        document.addEventListener(type, event => {
          const onHandle = event.target instanceof Element && Boolean(event.target.closest(".atlas-country-sheet-toggle"));
          if (type === "pointerdown" && onHandle) handlePointer = event.pointerId;
          if (!onHandle && event.pointerId !== handlePointer) return;
          const sheet = document.querySelector(".atlas-country-presentation");
          if (window.__nativePlanetSheetEvents.length < 200) window.__nativePlanetSheetEvents.push({
            type, trusted: event.isTrusted, pointerType: event.pointerType, pointerId: event.pointerId,
            clientX: event.clientX, clientY: event.clientY, at: performance.now(),
            state: sheet?.getAttribute("data-atlas-sheet-state"), dragging: sheet?.getAttribute("data-atlas-sheet-dragging"),
            bounds: sheet?.getBoundingClientRect().toJSON() });
          if (type === "pointerup" || type === "pointercancel") handlePointer = null;
        }, { capture: true, passive: true });
      }
    }
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
      const observed = this.matches('#country-search, [data-atlas-action="toggle-search"], [data-planet-welcome-action], .country-panel, .atlas-country-presentation, .writer-detail');
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
  }, { language, observeSheetGesture, capabilityHints, ...(indexedDBAvailable ? {} : { indexedDBAvailable: false }) });
  await page.route("**/*", async request => {
    const url = new URL(request.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await request.abort(); return; }
    if (request.request().resourceType() === "document" && url.pathname === "/") {
      await request.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="' + language + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/native-planet.css"></head><body><div id="root"></div><script src="/fixture/native-planet.js"></script></body></html>' });
      return;
    }
    const bytes = files.get(decodeURIComponent(url.pathname));
    if (bytes) { await request.fulfill({ contentType: mime[path.extname(url.pathname)] ?? "application/octet-stream", body: bytes }); return; }
    if (url.pathname !== "/favicon.ico") missingResources.push(url.pathname);
    await request.fulfill({ status: 404, contentType: "text/plain", body: "Unselected fixture resource" });
  });
  await page.goto(origin + route);
  expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
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
        writerFocusDiagnostics: window.__nativePlanetWriterFocusDiagnostics ?? [],
        finalActiveElement: { tag: document.activeElement?.tagName, id: document.activeElement?.id,
          action: document.activeElement?.getAttribute("data-atlas-action") },
        journeyRandomInput: window.__nativePlanetJourneyRandom ?? null,
        nativeLifecycleEvents: window.__nativePlanetHarness?.lifecycleEvents() ?? [],
        countrySheetEvents: window.__nativePlanetSheetEvents ?? [],
        countrySheetMeasurements: window.__nativePlanetSheetMeasurements ?? [],
        graphicsObservations: window.__nativePlanetGraphicsObservations ?? [],
        appearanceObservations: window.__nativePlanetAppearanceObservations ?? [],
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
    browserCapabilities: fixture.browserCapabilities,
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

// Root actions use the genuine disclosure; Collection owns its separate locale control.
async function nativeMenu(page, input = "click") {
  const chrome = page.locator(".atlas-application-chrome");
  const toggle = chrome.locator('[data-atlas-action="toggle-menu"]');
  const panel = chrome.locator("[data-atlas-application-menu-panel]");
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle[input]();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  return panel;
}

async function nativeMenuAction(page, action) {
  const panel = await nativeMenu(page);
  await panel.locator('[data-atlas-action="' + action + '"]').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]')).toHaveAttribute("aria-expanded", "false");
}

async function nativeLanguageButton(page, scope, language) {
  const button = scope.locator('.interface-language-control button[data-interface-language="' + language + '"]');
  const currentLanguage = await page.locator("html").getAttribute("lang");
  const label = currentLanguage === "ru"
    ? language === "ru" ? "Русский язык" : "Английский язык"
    : language === "ru" ? "Russian" : "English";
  await expect(button).toHaveAccessibleName(label);
  await expect(button).toHaveAttribute("title", label);
  return button;
}

async function nativeLanguage(page, language, input = "click") {
  const panel = await nativeMenu(page, input);
  const button = await nativeLanguageButton(page, panel, language);
  await button[input]();
  await expect(panel).toBeHidden();
  await expect(page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]')).toHaveAttribute("aria-expanded", "false");
}

test("downloads live in the actual globe collection and retain the scene through RUEN and reopening", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia#atlas", viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true, preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  try {
    await nativeRootReady(page); const original = await captureScene(page);
    await nativeMenuAction(page, "open-collection");
    const panel = page.locator(".native-planet-panel"), downloads = panel.locator('[data-planet-downloads]');
    await downloads.locator("summary").click();
    await expect(downloads).toContainText("Дополнительных пакетов для загрузки пока нет.");
    await downloads.getByRole("button", { name: "Проверить место", exact: true }).click();
    // This source fixture intentionally has no native storage plugin. Missing
    // native capacity must stay unavailable, with no browser fallback.
    await expect(downloads.locator('[data-storage-space]')).toHaveAttribute("data-storage-space", "unavailable");
    await expect(downloads.getByRole("button", { name: "Проверить место", exact: true })).toBeFocused();
    await (await nativeLanguageButton(page, panel, "en")).click();
    await expect(downloads.locator("summary")).toHaveText("Downloads");
    await expect(downloads).toContainText("There are no additional packages to download yet.");
    await expect(downloads).toContainText("Available space could not be determined.");
    await retained(page, original);
    await panel.getByRole("button", { name: "Return to the planet", exact: true }).click();
    await nativeMenuAction(page, "open-collection");
    await expect(downloads).toHaveAttribute("open", "");
    await retained(page, original);
    const colors = await downloads.evaluate(element => ({ ink: getComputedStyle(element).color, surface: getComputedStyle(element).backgroundColor,
      expectedInk: getComputedStyle(element).getPropertyValue("--planet-ink").trim(), expectedSurface: getComputedStyle(element).getPropertyValue("--planet-card").trim() }));
    expect(colors.expectedInk).not.toBe(""); expect(colors.expectedSurface).not.toBe("");
    await evidence(fixture, testInfo, "downloads-canonical-globe-source", { sameCanvasRendererCameraScene: true, locales: ["ru", "en"],
      emptyApprovedCatalog: true, productionPackageActivated: false, colors });
  } finally { await page.close(); }
});

test("mobile globe search reveals the writer and restores Escape focus across RU and EN without replacing the scene", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=france#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const { page } = fixture;
  const original = await captureScene(page);
  const sheet = page.locator(".atlas-country-presentation");
  const toggle = page.locator(".atlas-country-sheet-toggle");
  const opener = page.locator('[data-atlas-action="toggle-search"]');
  const input = page.locator("#country-search");
  const observations = [];
  try {
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
    for (const locale of ["ru", "en"]) {
      if (locale === "en") {
        const pose = await settledCameraPose(original);
        const previousUrl = new URL(page.url());
        await nativeLanguage(page, "en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.locator(".writer-detail h4")).toContainText(/Dostoevsky/iu);
        await retained(page, original);
        expect(await cameraPose(original)).toEqual(pose);
        for (const key of ["country", "writer", "book"]) expect(new URL(page.url()).searchParams.get(key)).toBe(previousUrl.searchParams.get(key));
        await toggle.click();
        await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "expanded");
        await toggle.click();
        await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
      }
      await opener.click();
      await expect(input).toBeFocused();
      const query = locale === "ru" ? "Достоевский" : "Dostoevsky";
      await input.fill(query);
      const writerOption = page.locator('#country-results [role="option"]').filter({ hasText: locale === "ru" ? /Ф[её]дор.*Достоевск/iu : /Fyodor.*Dostoevsky/iu }).first();
      await expect(writerOption).toBeVisible();
      if (locale === "ru") await writerOption.click();
      else {
        // Navigate the real combobox instead of calling its selection callback.
        const optionId = await writerOption.getAttribute("id");
        await input.press("Home");
        for (let step = 0; step < 12 && await input.getAttribute("aria-activedescendant") !== optionId; step++) await input.press("ArrowDown");
        await expect(input).toHaveAttribute("aria-activedescendant", optionId);
        await input.press("Enter");
      }
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const detail = page.locator(".writer-detail");
      await expect(detail).toBeFocused();
      await expect(detail.locator("h4")).toBeInViewport();
      expect(await detail.evaluate(element => Boolean(element.closest('[inert], [hidden], [aria-hidden="true"]')))).toBe(false);
      await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-search-open", "false");
      await retained(page, original);
      const selectedPose = await settledCameraPose(original);
      const selectedUrl = page.url();
      await evidence(fixture, testInfo, "native-search-" + locale + "-writer", { query, locale,
        writerFocusedWithoutManualSheetExpansion: true, sameCanvasRendererCameraScene: true, selectedPose });
      await opener.click();
      await input.fill(query);
      await expect(input).toBeFocused();
      await input.press("Escape");
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-search-open", "false");
      await expect(opener).toBeFocused();
      await expect(opener).toBeInViewport({ ratio: 1 });
      expect(page.url()).toBe(selectedUrl);
      expect(await cameraPose(original)).toEqual(selectedPose);
      await retained(page, original);
      observations.push({ locale, query, resultCountry: "russia", resultWriter: "dostoevsky", selectedPose,
        directWriterFocus: true, escapeReturnedToOpener: true });
    }
    await opener.click();
    await input.fill("France");
    await page.locator('#country-results [data-option-key="country:france"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("france");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
    await expect(toggle).toBeFocused();
    await expect(toggle).toBeInViewport({ ratio: 1 });
    await retained(page, original);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await opener.click();
    await input.fill("Dostoevsky");
    await page.locator('#country-results [data-option-key="writer:russia:dostoevsky"]').click();
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    await expect(page.locator(".writer-detail")).toBeFocused();
    await expect(page.locator(".writer-detail h4")).toBeInViewport();
    await retained(page, original);
    expect(fixture.consoleErrors).toEqual([]);
    const canonicalBookAliases = await page.evaluate(() => window.__nativePlanetHarness.canonicalBookAliasAudit());
    await evidence(fixture, testInfo, "native-search-bilingual-complete", { observations,
      canonicalBookAliases, normalMotionWriterFocusPassed: true, countrySearchFocusOnVisibleToggle: true,
      actualCatalog: true, sameCanvasRendererCameraScene: true, nativeDeviceObserved: false });
  } finally { await original.dispose(); }
});

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
      await nativeLanguage(page, language);
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

async function nativeGraphicsEvidence(page, phase) {
  return page.evaluate(phase => {
    const current = window.__nativePlanetHarness.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
    const pointVertexCounts = [], sphereMeshes = [];
    current.scene.traverse(object => {
      if (object.isPoints) pointVertexCounts.push(object.geometry.getAttribute("position").count);
      if (object.isMesh && object.geometry?.type === "SphereGeometry") {
        const { radius, widthSegments, heightSegments } = object.geometry.parameters;
        sphereMeshes.push({ radius, widthSegments, heightSegments, scale: object.scale.toArray(),
          materialTypes: (Array.isArray(object.material) ? object.material : [object.material]).map(material => material.type) });
      }
    });
    const result = { phase, hints: { saveData: navigator.connection?.saveData, deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency }, browserPixelRatio: devicePixelRatio,
      rendererPixelRatio: current.renderer.getPixelRatio(), pointVertexCounts, sphereMeshes,
      drawingBuffer: { width: current.canvas.width, height: current.canvas.height },
      economical: document.querySelector("[data-atlas-experience]")?.getAttribute("data-atlas-economical"),
      qualityTier: document.querySelector("#atlas .literary-globe")?.getAttribute("data-globe-quality-tier"),
      edition: document.querySelector("#atlas .literary-globe")?.getAttribute("data-globe-edition"),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches };
    (window.__nativePlanetGraphicsObservations ??= []).push(result);
    return result;
  }, phase);
}

async function applicationAppearanceEvidence(page, phase) {
  return page.evaluate(phase => {
    const selectors = { chrome: ".atlas-immersive-chrome", controls: ".globe-controls", searchField: "#country-search", searchSurface: ".atlas-heading .search-field",
      searchResults: "#country-results", country: ".atlas-country-presentation .country-panel", countryToggle: ".atlas-country-sheet-toggle",
      collection: ".native-planet-panel", collectionHeader: ".native-planet-panel__header", archiveHeading: ".book-archive-heading",
      archiveCard: ".archive-book-card", filterDrawer: "#book-archive-advanced-filters",
      editionSelect: ".globe-edition-compact-select select", scaleFeedback: ".globe-scale-feedback" };
    const surfaces = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (!element) { surfaces[name] = null; continue; }
      const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
      surfaces[name] = { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
        color: style.color, borderColor: style.borderColor, outlineColor: style.outlineColor,
        bounds: bounds.toJSON(), visible: Boolean(bounds.width && bounds.height && style.display !== "none" && style.visibility !== "hidden") };
    }
    const themedAttributes = element => element ? Object.fromEntries([...element.attributes]
      .filter(attribute => /(?:theme|appearance|palette|globe-style|globe-edition|planet-(?:portal-)?edition)/u.test(attribute.name))
      .map(attribute => [attribute.name, attribute.value])) : {};
    const app = document.querySelector(".native-planet-app"), appStyle = getComputedStyle(app);
    const tokens = Object.fromEntries(["space", "chrome", "chrome-raised", "surface", "card", "ink", "accent", "accent-strong", "on-dark"]
      .map(name => [name, appStyle.getPropertyValue("--planet-" + name).trim()]));
    const textContrasts = {};
    const rgb = value => value.match(/[\d.]+/gu)?.map(Number) ?? [];
    const luminance = values => values.slice(0, 3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    for (const [name, selector] of Object.entries({ randomAction: ".book-shelf-controls__random span", cardStatus: ".archive-book-copy .editorial-state", fallbackAuthor: ".archive-book-cover:not(.has-image) small" })) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const foreground = getComputedStyle(element).color;
      let backgroundElement = element;
      while (backgroundElement && (rgb(getComputedStyle(backgroundElement).backgroundColor)[3] ?? 1) !== 1) backgroundElement = backgroundElement.parentElement;
      if (!backgroundElement) continue;
      const background = getComputedStyle(backgroundElement).backgroundColor;
      const [light, dark] = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => b - a);
      const bounds = element.getBoundingClientRect();
      textContrasts[name] = { selector, foreground, background, backgroundElement: backgroundElement.className,
        backgroundImage: getComputedStyle(backgroundElement).backgroundImage,
        ratio: (light + .05) / (dark + .05), bounds: bounds.toJSON(), opacity: getComputedStyle(element).opacity };
    }
    const bookCards = [...document.querySelectorAll(".native-planet-panel .archive-book-card")].map(card => {
      const title = card.querySelector(".archive-book-copy h3");
      return { bounds: card.getBoundingClientRect().toJSON(), title: title ? { text: title.textContent,
        bounds: title.getBoundingClientRect().toJSON(), clientWidth: title.clientWidth, scrollWidth: title.scrollWidth,
        clientHeight: title.clientHeight, scrollHeight: title.scrollHeight } : null,
        actions: [...card.querySelectorAll(".archive-book-actions button")].map(button => ({
          label: button.getAttribute("aria-label") ?? button.textContent, bounds: button.getBoundingClientRect().toJSON() })) };
    });
    const result = { phase, language: document.documentElement.lang, surfaces, tokens, textContrasts, bookCards,
      rootAttributes: themedAttributes(document.documentElement), bodyAttributes: themedAttributes(document.body),
      appAttributes: themedAttributes(app),
      globeAttributes: themedAttributes(document.querySelector("#atlas .literary-globe")) };
    (window.__nativePlanetAppearanceObservations ??= []).push(result);
    return result;
  }, phase);
}

function expectAppearanceSurface(appearance, name, background, foreground) {
  const surface = appearance.surfaces[name];
  const channels = token => {
    expect(token).toMatch(/^#[0-9a-f]{6}$/iu);
    return [1, 3, 5].map(offset => Number.parseInt(token.slice(offset, offset + 2), 16));
  };
  const back = channels(appearance.tokens[background]), front = channels(appearance.tokens[foreground]);
  expect(surface.visible, name + " is rendered").toBe(true);
  expect(surface.backgroundColor, name + " uses the committed edition surface").toBe("rgb(" + back.join(", ") + ")");
  expect(surface.color, name + " uses the committed edition foreground").toBe("rgb(" + front.join(", ") + ")");
  const luminance = values => values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const [light, dark] = [luminance(back), luminance(front)].sort((a, b) => b - a);
  expect((light + .05) / (dark + .05), name + " text contrast on its actual opaque surface").toBeGreaterThanOrEqual(4.5);
}

test("native application defaults to rich graphics under low-resource hints while respecting reduced motion and RU/EN scene identity", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas", reducedMotion: "no-preference", deviceScaleFactor: 2,
    viewport: { width: 1440, height: 800 },
    capabilityHints: { saveData: true, deviceMemory: 2, hardwareConcurrency: 2 } });
  const { page } = fixture;
  const original = await captureScene(page);
  const preferenceKey = "probpera-planet-graphics-quality-v1";
  const profiles = {
    high: { dpr: 1.5, stars: 2400, main: [144, 96], highlight: [112, 72], sky: [48, 32], material: "ShaderMaterial" },
    balanced: { dpr: 1.25, stars: 1600, main: [128, 84], highlight: [104, 68], sky: [36, 24], material: "ShaderMaterial" },
    economy: { dpr: 1.1, stars: 900, main: [112, 72], highlight: [96, 64], sky: [24, 16], material: "MeshBasicMaterial" },
  };
  const changes = [], locales = [];
  const globe = page.locator("#atlas .literary-globe");
  const panel = page.locator(".native-planet-panel");
  const settings = panel.locator("[data-planet-graphics-settings]");
  const checkedProfile = tier => settings.locator('[data-planet-quality-option="' + tier + '"]');
  const readProfile = async (tier, phase) => {
    const expected = profiles[tier];
    await expect(globe).toHaveAttribute("data-globe-quality-tier", tier);
    await expect(page.locator("[data-atlas-experience]")).toHaveAttribute("data-atlas-economical", tier === "economy" ? "true" : "false");
    await expect.poll(async () => {
      const actual = await nativeGraphicsEvidence(page, phase + "-settling");
      const sphere = (radius, segments, material, scale) => actual.sphereMeshes.some(mesh => mesh.radius === radius
        && mesh.widthSegments === segments[0] && mesh.heightSegments === segments[1]
        && (!material || mesh.materialTypes.includes(material)) && (!scale || mesh.scale.every(value => value === scale)));
      return { dpr: actual.rendererPixelRatio, stars: actual.pointVertexCounts.includes(expected.stars),
        main: sphere(1, expected.main), highlight: sphere(1.006, expected.highlight),
        sky: sphere(1, expected.sky, expected.material, 22) };
    }).toEqual({ dpr: expected.dpr, stars: true, main: true, highlight: true, sky: true });
    const actual = await nativeGraphicsEvidence(page, phase);
    expect(actual.qualityTier).toBe(tier);
    expect(actual.edition).toBe("rand-mcnally-1887");
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    return actual;
  };
  const settingsLabels = { ru: ["Высокое", "Сбалансированное", "Экономное"], en: ["High", "Balanced", "Economy"] };
  const inspectSettings = async language => {
    await expect(settings.locator("summary")).toHaveText(language === "ru" ? "Настройки графики" : "Graphics settings");
    await expect(settings.locator("fieldset")).toHaveAccessibleName(language === "ru" ? "Качество графики" : "Graphics quality");
    for (const [index, tier] of ["high", "balanced", "economy"].entries()) {
      await expect(checkedProfile(tier)).toHaveAccessibleName(settingsLabels[language][index]);
      await expect(checkedProfile(tier)).toHaveAccessibleDescription(/\S/u);
    }
    const actual = await settings.evaluate(element => {
      const box = node => ({ bounds: node.getBoundingClientRect().toJSON(), clientWidth: node.clientWidth, scrollWidth: node.scrollWidth });
      const text = [...element.querySelectorAll("summary, legend, p:not(:empty), label strong, label > span > span")].map(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return { text: node.textContent, ...box(node), textRects: [...range.getClientRects()].map(rect => rect.toJSON()),
          fontSize: parseFloat(getComputedStyle(node).fontSize) };
      });
      return { viewport: { width: innerWidth, height: innerHeight }, rootFontSize: getComputedStyle(document.documentElement).fontSize,
        ...box(element), text, targets: [...element.querySelectorAll("input[type=radio]")].map(input => ({
          tier: input.value, checked: input.checked, ...box(input.labels[0]) })) };
    });
    expect(actual.bounds.left).toBeGreaterThanOrEqual(0);
    expect(actual.bounds.right).toBeLessThanOrEqual(actual.viewport.width);
    expect(actual.scrollWidth).toBeLessThanOrEqual(actual.clientWidth + 1);
    for (const target of actual.targets) {
      expect(target.bounds.width, target.tier + " label target width").toBeGreaterThanOrEqual(44);
      expect(target.bounds.height, target.tier + " label target height").toBeGreaterThanOrEqual(44);
      expect(target.scrollWidth, target.tier + " label horizontal clipping").toBeLessThanOrEqual(target.clientWidth + 1);
    }
    for (const item of actual.text) {
      expect(item.scrollWidth, item.text + " horizontal clipping").toBeLessThanOrEqual(item.clientWidth + 1);
      for (const rect of item.textRects) {
        expect(rect.left, item.text + " left text edge").toBeGreaterThanOrEqual(actual.bounds.left - 1);
        expect(rect.right, item.text + " right text edge").toBeLessThanOrEqual(actual.bounds.right + 1);
      }
    }
    return actual;
  };
  const openSettings = async (language, keyboard = false) => {
    await nativeMenuAction(page, "open-collection");
    await expect(panel).toBeVisible();
    await expect(settings.locator("summary")).toHaveText(language === "ru" ? "Настройки графики" : "Graphics settings");
    if (keyboard) {
      await expect(panel.getByRole("button", { name: language === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(settings.locator("summary")).toBeFocused();
      if (await settings.getAttribute("open") === null) await page.keyboard.press("Space");
      await page.keyboard.press("Tab");
      await expect(checkedProfile("high")).toBeFocused();
    } else if (await settings.getAttribute("open") === null) await settings.locator("summary").click();
    await expect(settings.locator("fieldset legend")).toHaveText(language === "ru" ? "Качество графики" : "Graphics quality");
  };
  const closeSettings = async language => {
    await panel.getByRole("button", { name: language === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }).click();
    await expect(panel).toBeHidden();
  };
  let reloaded;
  try {
    await showWriter(page);
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    const initial = await readProfile("high", "initial-low-resource-hints");
    expect(initial.hints).toEqual({ saveData: true, deviceMemory: 2, hardwareConcurrency: 2 });
    expect(initial.browserPixelRatio).toBe(2);
    expect(initial.rendererPixelRatio).toBe(1.5);
    expect(initial.pointVertexCounts).toContain(2400);
    expect(initial.reducedMotion).toBe(false);
    const pose = await settledCameraPose(original);
    for (const language of ["en", "ru"]) {
      await nativeLanguage(page, language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe(language);
      await showWriter(page);
      await retained(page, original);
      expect(await cameraPose(original)).toEqual(pose);
      locales.push(await readProfile("high", "initial-locale-" + language));
    }
    let language = "ru";
    let keyboardSelection;
    const settingsLocales = [];
    for (const tier of ["balanced", "economy", "high"]) {
      await openSettings(language, tier === "balanced");
      if (tier === "balanced") {
        await page.keyboard.press("ArrowRight");
        await expect(checkedProfile(tier)).toBeFocused();
        keyboardSelection = await checkedProfile(tier).evaluate(element => ({
          focused: document.activeElement === element, focusVisible: element.matches(":focus-visible"),
          outlineStyle: getComputedStyle(element).outlineStyle, outlineWidth: parseFloat(getComputedStyle(element).outlineWidth),
          checked: element.checked, value: element.value }));
        expect(keyboardSelection.focusVisible).toBe(true);
        expect(keyboardSelection.outlineStyle).not.toBe("none");
        expect(keyboardSelection.outlineWidth).toBeGreaterThanOrEqual(2);
      } else await checkedProfile(tier).check();
      await expect(checkedProfile(tier)).toBeChecked();
      await expect.poll(() => fixture.preferenceMemory.get(preferenceKey)).toBe(tier);
      if (tier === "economy") {
        await (await nativeLanguageButton(page, panel, "en")).click();
        language = "en";
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe("en");
        await expect(settings.locator("summary")).toHaveText("Graphics settings");
        await expect(checkedProfile(tier)).toBeChecked();
        expect(fixture.preferenceMemory.get(preferenceKey)).toBe(tier);
      }
      if (tier !== "high") {
        const accessibility = await inspectSettings(language);
        settingsLocales.push({ locale: language, selectedProfile: tier, accessibility });
        await evidence(fixture, testInfo, "native-graphics-settings-" + tier, {
          selectedProfile: tier, preferenceKey, locale: language, nativePreferenceSaved: true, accessibility,
          ...(tier === "balanced" ? { keyboardSelection } : {}) });
      }
      await closeSettings(language);
      await showWriter(page);
      const actual = await readProfile(tier, "selected-profile-" + tier);
      expect(actual.reducedMotion).toBe(false);
      await retained(page, original);
      expect(await settledCameraPose(original)).toEqual(pose);
      changes.push(actual);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("[data-atlas-experience]")).toHaveAttribute("data-atlas-reduced-motion", "true");
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "reduced-motion");
    expect((await nativeGlobeRuntime(page)).autoRotate).toBe(false);
    const reduced = await readProfile("high", "reduced-motion-high-rendering");
    expect(reduced.reducedMotion).toBe(true);
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(pose);
    // Persist a non-default tier, then use an actual document reload. The OS
    // preference fixture survives outside the document; no storage reseeding.
    await openSettings("en");
    await checkedProfile("balanced").check();
    await expect.poll(() => fixture.preferenceMemory.get(preferenceKey)).toBe("balanced");
    await closeSettings("en");
    const beforeReload = await readProfile("balanced", "balanced-before-reload");
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(pose);
    await evidence(fixture, testInfo, "native-graphics-profiles-before-reload", { initial, locales, changes, reduced, beforeReload, settingsLocales, keyboardSelection,
      unchangedCameraPose: pose, selectedCountry: "russia", selectedWriter: "dostoevsky", edition: "rand-mcnally-1887",
      sameCanvasRendererCameraScene: true, graphicsScope: "Actual DPR, star buffers, sphere segments and sky material after explicit profile actions",
      capabilityFixture: "Browser capability hints and devicePixelRatio emulated; no physical low-memory GPU or performance guarantee" });
    await original.dispose();
    await page.reload();
    await nativeRootReady(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await showWriter(page);
    reloaded = await captureScene(page);
    const reloadedPose = await settledCameraPose(reloaded);
    const saved = await readProfile("balanced", "saved-balanced-after-reload");
    expect(saved.reducedMotion).toBe(true);
    expect((await nativeGlobeRuntime(page)).autoRotate).toBe(false);
    await openSettings("en");
    await expect(checkedProfile("balanced")).toBeChecked();
    expect(fixture.preferenceMemory.get(preferenceKey)).toBe("balanced");
    await (await nativeLanguageButton(page, panel, "ru")).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(settings.locator("summary")).toHaveText("Настройки графики");
    await expect(checkedProfile("balanced")).toBeChecked();
    await closeSettings("ru");
    await showWriter(page);
    const final = await readProfile("balanced", "saved-balanced-after-reload-ru");
    await retained(page, reloaded);
    expect(await settledCameraPose(reloaded)).toEqual(reloadedPose);
    await evidence(fixture, testInfo, "native-graphics-saved-balanced-ru", { saved, final, preferenceKey, persistedProfile: "balanced",
      selectedCountry: "russia", selectedWriter: "dostoevsky", edition: "rand-mcnally-1887",
      reloadScope: "Reload creates a new document and scene; saved native preference remains authoritative. Scene identity is verified within each document only.",
      sameCanvasRendererCameraSceneAfterReloadLocaleChange: true });
    // Test text enlargement only for the new settings. Viewport changes may
    // legitimately reframe the camera; object identity must still survive.
    await page.setViewportSize({ width: 320, height: 844 });
    await openSettings("ru");
    const normalText = await inspectSettings("ru");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    for (const language of ["ru", "en"]) {
      if (language === "en") {
        await (await nativeLanguageButton(page, panel, "en")).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe("en");
      }
      await expect(checkedProfile("balanced")).toBeChecked();
      expect(fixture.preferenceMemory.get(preferenceKey)).toBe("balanced");
      const returnButton = panel.getByRole("button", { name: language === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true });
      await expect(returnButton).toBeInViewport({ ratio: 1 });
      const returnBounds = await returnButton.boundingBox();
      expect(returnBounds.width).toBeGreaterThanOrEqual(44);
      expect(returnBounds.height).toBeGreaterThanOrEqual(44);
      expect(returnBounds.x).toBeGreaterThanOrEqual(0);
      expect(returnBounds.x + returnBounds.width).toBeLessThanOrEqual(320);
      const accessibility = { ...await inspectSettings(language), returnButton: { label: await returnButton.getAttribute("aria-label"), bounds: returnBounds } };
      expect(accessibility.text[0].fontSize / normalText.text[0].fontSize).toBeCloseTo(2, 4);
      for (const tier of ["high", "balanced", "economy"]) {
        await checkedProfile(tier).scrollIntoViewIfNeeded();
        await expect(checkedProfile(tier)).toBeInViewport();
      }
      await checkedProfile("balanced").scrollIntoViewIfNeeded();
      await retained(page, reloaded);
      const graphics = await readProfile("balanced", "narrow-text-200-" + language);
      await evidence(fixture, testInfo, "native-graphics-settings-narrow-" + language, { accessibility, graphics,
        sameCanvasRendererCameraScene: true, textScale: "Root font 200%; actual summary font measured at twice baseline",
        scope: "320 CSS px browser viewport; normal vertical scrolling allowed. New settings only; no physical device or OS text-scale claim." });
    }
    await closeSettings("en");
    await expect(page.locator('[data-atlas-action="toggle-menu"]')).toBeFocused();
    await retained(page, reloaded);
    await expect(page.locator(".country-heading img.country-flag")).toHaveAttribute("alt", "");
    await expect(page.locator(".country-heading img.country-flag")).toHaveAttribute("fetchpriority", "high");
    expect(fixture.consoleErrors).toEqual([]);
  } finally { await original.dispose(); await reloaded?.dispose(); }
});

test("native application appearance follows canonical globe editions while preserving rich graphics and scene", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas", reducedMotion: "no-preference", deviceScaleFactor: 2,
    viewport: { width: 1440, height: 800 },
    capabilityHints: { saveData: true, deviceMemory: 2, hardwareConcurrency: 2 } });
  const { page } = fixture;
  const original = await captureScene(page);
  try {
    await showWriter(page);
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
    const initial = await nativeGraphicsEvidence(page, "initial-low-resource-hints");
    expect(initial.hints).toEqual({ saveData: true, deviceMemory: 2, hardwareConcurrency: 2 });
    expect(initial.browserPixelRatio).toBe(2);
    expect(initial.economical).toBe("false");
    expect(initial.rendererPixelRatio).toBe(1.5);
    expect(initial.pointVertexCounts).toContain(2400);
    expect(initial.reducedMotion).toBe(false);
    const pose = await settledCameraPose(original);
    const locales = [];
    for (const language of ["en", "ru"]) {
      await nativeLanguage(page, language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe(language);
      await showWriter(page);
      await retained(page, original);
      expect(await cameraPose(original)).toEqual(pose);
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      const graphics = await nativeGraphicsEvidence(page, "locale-" + language);
      expect(graphics.economical).toBe("false");
      expect(graphics.rendererPixelRatio).toBe(1.5);
      expect(graphics.pointVertexCounts).toContain(2400);
      locales.push(graphics);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("[data-atlas-experience]")).toHaveAttribute("data-atlas-reduced-motion", "true");
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-auto-rotate", "reduced-motion");
    expect((await nativeGlobeRuntime(page)).autoRotate).toBe(false);
    const reduced = await nativeGraphicsEvidence(page, "reduced-motion-rich-rendering");
    expect(reduced.reducedMotion).toBe(true);
    expect(reduced.economical).toBe("false");
    expect(reduced.rendererPixelRatio).toBe(1.5);
    expect(reduced.pointVertexCounts).toContain(2400);
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(pose);
    await evidence(fixture, testInfo, "native-rich-default-low-hints", { initial, locales, reduced, unchangedCameraPose: pose,
      selectedCountry: "russia", selectedWriter: "dostoevsky", sameCanvasRendererCameraScene: true,
      graphicsScope: "Rich rendering across canonical appearances; profile controls have their own focused regression",
      capabilityFixture: "Browser hints and devicePixelRatio emulated before mount, not a physical low-memory GPU or performance guarantee" });
    const appearances = [];
    for (const [edition, style] of [["rand-mcnally-1887", "antique"], ["nasa-blue-marble", "earth"], ["natural-earth-2026", "modern"]]) {
      const globe = page.locator("#atlas .literary-globe");
      const editionSelect = page.locator(".globe-edition-compact-select select");
      await expect(editionSelect).toBeVisible();
      if (await globe.getAttribute("data-globe-edition") !== edition) await editionSelect.selectOption(edition);
      await expect(globe).toHaveAttribute("data-globe-edition", edition);
      await expect(globe).toHaveAttribute("data-globe-style", style);
      await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", edition);
      await expect(globe).toHaveAttribute("data-globe-edition-transition", "idle");
      if (style === "earth") {
        await nativeLanguage(page, "en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
      }
      await retained(page, original);
      expect(await settledCameraPose(original)).toEqual(pose);
      const graphics = await nativeGraphicsEvidence(page, "appearance-" + style);
      expect(graphics.economical).toBe("false");
      expect(graphics.rendererPixelRatio).toBe(1.5);
      expect(graphics.pointVertexCounts).toContain(2400);

      await expect(editionSelect).toHaveValue(edition);
      await expect(editionSelect).toBeEnabled();
      await expect(editionSelect).toHaveAttribute("aria-busy", "false");
      await expect(editionSelect).toHaveAccessibleName(/Текущее издание глобуса|Current globe edition/u);
      await expect(page.locator("#globe-edition-rail")).toBeHidden();
      await expect(page.locator('[data-globe-control="edition-rail-toggle"]')).toBeHidden();
      for (const cue of await page.locator(".globe-edition-scroll-cue").all()) await expect(cue).toBeHidden();
      await page.mouse.move(0, 0);
      const editionControls = await applicationAppearanceEvidence(page, style + "-edition-controls");
      for (const surface of ["editionSelect", "scaleFeedback"]) expectAppearanceSurface(editionControls, surface, "chrome", "on-dark");
      const editionOptions = await editionSelect.locator("option").evaluateAll(options => options.map(option => ({
        value: option.value, label: option.label, color: getComputedStyle(option).color,
        backgroundColor: getComputedStyle(option).backgroundColor })));
      expect(editionOptions.map(option => option.value)).toEqual(await page.locator("#globe-edition-rail [data-globe-edition-option]").evaluateAll(buttons => buttons.map(button => button.dataset.globeEditionOption)));
      for (const option of editionOptions) {
        expect(option.label.trim()).not.toBe("");
        expect(option.color).toBe(editionControls.surfaces.editionSelect.color);
        expect(option.backgroundColor).toBe(editionControls.surfaces.editionSelect.backgroundColor);
      }
      editionControls.editionOptions = editionOptions;
      await page.locator('[data-atlas-action="toggle-search"]').click();
      await page.locator("#country-search").fill("Достоевский");
      await expect(page.locator('#country-results [role="option"]').filter({ hasText: /Достоевск|Dostoevsk/iu }).first()).toBeVisible();
      const search = await applicationAppearanceEvidence(page, style + "-search");
      for (const surface of ["chrome", "searchSurface", "searchResults"]) expectAppearanceSurface(search, surface, "chrome", "on-dark");
      expectAppearanceSurface(search, "country", "surface", "ink");
      await evidence(fixture, testInfo, "native-appearance-" + style + "-search", { appearance: search, graphics, editionControls,
        committedEdition: edition, sameCanvasRendererCameraScene: true });
      await page.keyboard.press("Escape");

      await nativeMenuAction(page, "open-collection");
      const panel = page.locator(".native-planet-panel");
      await expect(panel).toBeVisible();
      await expect(panel.locator(".book-archive-heading")).toBeVisible();
      await expect(panel.locator(".archive-book-card").first()).toBeVisible();
      const collection = await applicationAppearanceEvidence(page, style + "-collection");
      for (const surface of ["collection", "collectionHeader"]) expectAppearanceSurface(collection, surface, "surface", "ink");
      expectAppearanceSurface(collection, "archiveCard", "chrome-raised", "on-dark");
      expect(collection.surfaces.archiveHeading.visible).toBe(true);
      expect(collection.tokens).toEqual(search.tokens);
      for (const name of ["randomAction", "cardStatus", "fallbackAuthor"]) expect(collection.textContrasts[name].ratio, name + " actual text contrast").toBeGreaterThanOrEqual(4.5);
      for (const card of collection.bookCards) {
        expect(card.title.scrollWidth, card.title.text + " title is not horizontally clipped").toBeLessThanOrEqual(card.title.clientWidth + 1);
        expect(card.title.scrollHeight, card.title.text + " full title remains readable").toBeLessThanOrEqual(card.title.clientHeight + 1);
        for (const action of card.actions) {
          expect(action.bounds.left, action.label + " remains inside its card").toBeGreaterThanOrEqual(card.bounds.left);
          expect(action.bounds.right, action.label + " remains inside its card").toBeLessThanOrEqual(card.bounds.right);
          expect(action.bounds.bottom, action.label + " remains inside its card").toBeLessThanOrEqual(card.bounds.bottom);
        }
      }
      await evidence(fixture, testInfo, "native-appearance-" + style + "-collection", { appearance: collection,
        committedEdition: edition, sameCanvasRendererCameraScene: true });
      if (style === "modern") {
        await panel.getByRole("button", { name: "Advanced filters", exact: true }).click();
        const drawer = page.locator("#book-archive-advanced-filters");
        await expect(drawer).toBeVisible();
        await expect(page.locator("body")).toHaveAttribute("data-planet-portal-edition", edition);
        const closeFilters = drawer.getByRole("button", { name: "Close filters", exact: true });
        await expect(closeFilters).toBeFocused();
        await page.keyboard.press("Tab");
        expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("Shift+Tab");
        await expect(closeFilters).toBeFocused();
        const keyboardFocus = await closeFilters.evaluate(element => ({ focused: document.activeElement === element,
          outline: getComputedStyle(element).outline, color: getComputedStyle(element).color,
          backgroundColor: getComputedStyle(element).backgroundColor }));
        const portal = await applicationAppearanceEvidence(page, "modern-advanced-filter-portal");
        expectAppearanceSurface(portal, "filterDrawer", "surface", "ink");
        expect(portal.tokens).toEqual(collection.tokens);
        await evidence(fixture, testInfo, "native-appearance-modern-filter-portal", { appearance: portal, keyboardFocus, committedEdition: edition });
        await closeFilters.click();
        await expect(drawer).toBeHidden();
        await expect(panel.getByRole("button", { name: "Advanced filters", exact: true })).toBeFocused();
      }
      await panel.getByRole("button", { name: /^(?:Вернуться к планете|Return to the planet)$/u }).click();
      await expect(panel).toBeHidden();
      await retained(page, original);
      expect(await settledCameraPose(original)).toEqual(pose);
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      appearances.push({ edition, style, search, collection, editionControls });
    }
    const paint = surface => JSON.stringify([surface.backgroundColor, surface.backgroundImage, surface.color]);
    for (const surface of ["chrome", "searchSurface", "searchResults"]) {
      expect(new Set(appearances.map(appearance => paint(appearance.search.surfaces[surface]))).size, surface + " follows all three canonical appearances").toBe(3);
    }
    for (const surface of ["collection", "collectionHeader", "archiveCard"]) {
      expect(new Set(appearances.map(appearance => paint(appearance.collection.surfaces[surface]))).size, surface + " follows all three canonical appearances").toBe(3);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const narrowSession = await page.context().newCDPSession(page);
    await narrowSession.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
    try {
      await retained(page, original);
      await page.mouse.move(0, 0);
      await expect(page.locator(".atlas-country-sheet-toggle")).toBeVisible();
      const narrow = await applicationAppearanceEvidence(page, "modern-narrow-header");
      expectAppearanceSurface(narrow, "chrome", "chrome", "on-dark");
      expectAppearanceSurface(narrow, "countryToggle", "chrome", "on-dark");
      for (const surface of ["editionSelect", "scaleFeedback"]) expectAppearanceSurface(narrow, surface, "chrome", "on-dark");
      const header = page.locator(".atlas-immersive-chrome");
      const headerBounds = await header.boundingBox();
      expect(headerBounds.y).toBeGreaterThanOrEqual(59);
      expect(headerBounds.x).toBeGreaterThanOrEqual(0);
      expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(390);
      const visibleHeaderButtons = header.locator("button:visible");
      await expect(visibleHeaderButtons).toHaveCount(3);
      expect(await visibleHeaderButtons.evaluateAll(buttons => buttons.map(button => button.dataset.atlasAction))).toEqual(["toggle-filters", "toggle-search", "toggle-menu"]);
      const buttons = [];
      for (const button of await header.locator("button").all()) {
        if (!await button.isVisible()) continue;
        const bounds = await button.boundingBox();
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(headerBounds.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(headerBounds.x + headerBounds.width);
        buttons.push({ label: await button.getAttribute("aria-label") ?? await button.innerText(), bounds });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await evidence(fixture, testInfo, "native-appearance-modern-narrow-header", { appearance: narrow, header: headerBounds, buttons,
        safeArea: { top: 59, bottom: 34 }, geometryScope: "Actual Chrome CSS viewport and safe-area emulation, not an installed mobile OS",
        sameCanvasRendererCameraScene: true });
    } finally { await narrowSession.detach(); }
    await page.setViewportSize({ width: 1440, height: 800 });
    await retained(page, original);
    await evidence(fixture, testInfo, "native-appearance-quality-preserved", { appearances, unchangedCameraPoseBeforeViewportResize: pose,
      finalCameraPose: await settledCameraPose(original), viewportResizeScope: "Same camera object retained; viewport changes may reframe presentation",
      selectedCountry: "russia", selectedWriter: "dostoevsky", locale: "en", sameCanvasRendererCameraScene: true });
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

test("WebGL context recovery retains the canonical globe, camera pose and RUEN selection", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky", reducedMotion: "reduce",
    preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture, globe = page.locator("#atlas .literary-globe");
  const original = await captureScene(page);
  let contextProbe;
  try {
    await showWriter(page);
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    const initialPose = await settledCameraPose(original);
    const bounds = await globe.locator("canvas").boundingBox();
    expect(bounds).not.toBeNull();
    const point = { x: bounds.x + 64, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 90, point.y - 25, { steps: 6 });
    await page.mouse.up(); await page.mouse.move(0, 0);
    const rotatedPose = await settledCameraPose(original);
    expect(rotatedPose.quaternion).not.toEqual(initialPose.quaternion);
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    // The selected writer starts at the maximum focus scale. Zoom outward
    // through the real enabled control before exercising recovery.
    await globe.locator('[data-globe-control="zoom-out"]').click();
    const zoomedPose = await settledCameraPose(original);
    const radius = pose => Math.hypot(...pose.position);
    expect(radius(zoomedPose)).toBeGreaterThan(radius(rotatedPose));
    // Automatic rotation is off and manual damping has settled. Recovery must
    // preserve this deliberate pose, independently of unfinished gesture inertia.
    const beforeLoss = zoomedPose;
    contextProbe = await original.evaluateHandle(({ canvas, renderer }) => {
      const context = renderer.getContext(), extension = context.getExtension("WEBGL_lose_context");
      if (!extension) throw Error("Chrome must expose WEBGL_lose_context for real recovery evidence");
      const events = [];
      const lost = event => events.push({ type: event.type, trusted: event.isTrusted, contextLost: context.isContextLost() });
      const restored = event => events.push({ type: event.type, trusted: event.isTrusted, contextLost: context.isContextLost() });
      canvas.addEventListener("webglcontextlost", lost); canvas.addEventListener("webglcontextrestored", restored);
      return { lose: () => extension.loseContext(), snapshot: () => ({ events: [...events], contextLost: context.isContextLost() }),
        dispose: () => { canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); } };
    });
    await contextProbe.evaluate(probe => probe.lose());
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "lost");
    await expect(globe).toHaveAttribute("data-globe-frame-mode", "never");
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    await expect(globe.locator('.globe-webgl-recovery[role="alert"]')).toContainText("Отображение глобуса было прервано");
    await expect(globe.getByRole("button", { name: "Восстановить глобус", exact: true })).toBeVisible();
    await expect.poll(() => contextProbe.evaluate(probe => probe.snapshot().contextLost)).toBe(true);
    await page.mouse.up(); await page.mouse.move(0, 0);
    const lostFrames = await backgroundFrameEvidence(page);
    expect(await cameraPose(original)).toEqual(beforeLoss);
    await retained(page, original);
    await evidence(fixture, testInfo, "native-context-lost-ru", { initialPose, rotatedPose, zoomedPose, beforeLoss, lostFrames,
      actualExtension: "WEBGL_lose_context", stableManualPose: true, syntheticContextEvents: false,
      sameCanvasRendererCameraScene: true });
    await nativeLanguage(page, "en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "lost");
    await expect(globe.locator('.globe-webgl-recovery[role="alert"]')).toContainText("The globe display was interrupted");
    expect(await cameraPose(original)).toEqual(beforeLoss); await retained(page, original);
    await globe.getByRole("button", { name: "Restore globe", exact: true }).click();
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 20_000 });
    await expect(globe.locator(".globe-webgl-recovery")).toHaveCount(0);
    await expect.poll(() => contextProbe.evaluate(probe => probe.snapshot().contextLost)).toBe(false);
    await expect.poll(async () => (await nativeGlobeRuntime(page)).frameloop).toBe("demand");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).controlsEnabled).toBe(true);
    expect(await settledCameraPose(original)).toEqual(beforeLoss);
    await retained(page, original); await showWriter(page);
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    const contextEvents = await contextProbe.evaluate(probe => probe.snapshot());
    expect(contextEvents.events).toEqual([
      { type: "webglcontextlost", trusted: true, contextLost: true },
      { type: "webglcontextrestored", trusted: true, contextLost: false },
    ]);
    await evidence(fixture, testInfo, "native-context-restored-en", { beforeLoss, restoredPose: await cameraPose(original), contextEvents,
      sameCanvasRendererCameraScene: true, country: "russia", writer: "dostoevsky", actualExtension: "WEBGL_lose_context" });
    await nativeLanguage(page, "ru");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    expect(await cameraPose(original)).toEqual(beforeLoss); await retained(page, original);
    const restoredFrame = (await nativeGlobeRuntime(page)).renderFrame;
    await globe.locator('[data-globe-control="zoom-in"]').click();
    await expect.poll(async () => (await nativeGlobeRuntime(page)).renderFrame).toBeGreaterThan(restoredFrame);
    expect(radius(await settledCameraPose(original))).toBeLessThan(radius(beforeLoss));
    await retained(page, original);
    // A real tap must still select a country after the drag filter is applied.
    const label = globe.locator(".globe-country-label");
    let tapPoint, hoverCode;
    for (const offset of [90, 150, 210, 270]) {
      const candidate = { x: point.x + offset, y: point.y - 25 };
      await page.mouse.move(candidate.x, candidate.y);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (await label.count() && await label.getAttribute("data-country-label-source") === "hover") {
        const code = await label.getAttribute("data-country-code");
        if (code && code !== "RU") { tapPoint = candidate; hoverCode = code; break; }
      }
    }
    expect(tapPoint, "a visible canonical country different from the selection").toBeDefined();
    await page.mouse.click(tapPoint.x, tapPoint.y); await page.mouse.move(0, 0);
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).not.toBe("russia");
    await expect(label).toHaveAttribute("data-country-label-source", "selection");
    await expect(label).toHaveAttribute("data-country-code", hoverCode);
    const selectedAfterTap = new URL(page.url()).searchParams.get("country");
    expect(await page.evaluate(id => window.__nativePlanetHarness.canonicalCountry(id), selectedAfterTap)).not.toBeNull();
    expect(fixture.consoleErrors).toEqual([]);
    await retained(page, original);
    await testInfo.attach("globe-context-recovery-result", { contentType: "application/json", body: JSON.stringify({
      pass: true, actualCanonicalApp: true, actualWebGlContextLoss: true, contextEvents,
      lostFrames, beforeLoss, sameCanvasRendererCameraScene: true, posePreservedOnRecovery: true,
      resumedZoomRendered: true, locales: ["ru", "en", "ru"], country: "russia", writer: "dostoevsky",
      dragPreservedSelection: true, actualTapSelectedCanonicalCountry: selectedAfterTap,
      gpuPixelComparison: false, installedNative: false, releaseReady: false,
    }, null, 2) });
  } finally {
    await page.mouse.up();
    if (contextProbe) { await contextProbe.evaluate(probe => probe.dispose()); await contextProbe.dispose(); }
    await original.dispose();
  }
});

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

    // Interrupt a real drag without delivering pointerup to the active rig.
    // A native background event must end its parent interaction pause itself.
    const canvasBounds = await globe.locator("canvas").boundingBox();
    expect(canvasBounds).not.toBeNull();
    await page.mouse.move(canvasBounds.x + 64, canvasBounds.y + canvasBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + 124, canvasBounds.y + canvasBounds.height / 2, { steps: 4 });
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "manual");
    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(false))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-render-loop", "paused");
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    await page.mouse.move(0, 0);
    expect(await page.evaluate(() => window.__nativePlanetHarness.setAppActive(true))).toBe(1);
    await expect(globe).toHaveAttribute("data-globe-auto-rotate", "active", { timeout: 5000 });
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "auto");
    await expect.poll(async () => (await nativeGlobeRuntime(page)).autoRotate).toBe(true);
    await retained(page, original);

    const delayedRelease = await page.evaluateHandle(() => {
      const element = document.querySelector("#atlas .literary-globe");
      const current = window.__nativePlanetHarness.scenes().find(value => element.contains(value.canvas));
      let endEvents = 0;
      const phases = [];
      const onEnd = () => { endEvents += 1; };
      const observer = new MutationObserver(records => {
        phases.push(...records.map(record => record.oldValue), element.getAttribute("data-globe-camera-phase"));
      });
      observer.observe(element, { attributes: true, attributeFilter: ["data-globe-camera-phase"], attributeOldValue: true });
      current.controls.addEventListener("end", onEnd);
      return { snapshot: () => ({ endEvents, phases: [...phases] }),
        dispose: () => { observer.disconnect(); current.controls.removeEventListener("end", onEnd); } };
    });
    let delayedReleaseEvidence;
    try {
      await page.mouse.up();
      await expect.poll(() => delayedRelease.evaluate(probe => probe.snapshot().endEvents)).toBe(1);
      await browserFrames(page);
      delayedReleaseEvidence = await delayedRelease.evaluate(probe => probe.snapshot());
      expect(delayedReleaseEvidence.phases).not.toContain("settling");
      await expect(globe).toHaveAttribute("data-globe-camera-phase", "auto");
      await expect(globe).toHaveAttribute("data-globe-auto-rotate", "active");
      await retained(page, original);
    } finally {
      await delayedRelease.evaluate(probe => probe.dispose());
      await delayedRelease.dispose();
    }
    await evidence(fixture, testInfo, "native-host-interrupted-drag", { delayedReleaseEvidence,
      rotationResumedBeforePointerUp: true, sameCanvasRendererCameraScene: true,
      nativeLifecycleFixture: "Real Chrome drag interrupted by injected App lifecycle; late real pointerup observed" });

    // Select an existing canonical writer through the real UI, then preserve
    // that selection, locale and reduced-motion preference across another cycle.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator("#country-search").fill("Достоевский");
    await page.locator('#country-results [role="option"]').filter({ hasText: /Ф[её]дор.*Достоевск/iu }).first().click();
    await showWriter(page);
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await nativeLanguage(page, "en");
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
      sameCanvasRendererCameraScene: true, nativeLifecycleFixture: "Three injected OS lifecycle cycles with real App/R3F behavior",
      batteryOrDeviceMeasurement: false });
  } finally { await original.dispose(); }
});

const countrySheetSelector = '.atlas-country-presentation[data-atlas-country="russia"]';

async function sheetMeasurement(page, phase) {
  return page.evaluate(({ selector, phase }) => {
    const sheet = document.querySelector(selector), handle = sheet.querySelector(".atlas-country-sheet-toggle");
    const content = sheet.querySelector(".country-panel:not(.panel-loading)");
    const result = { phase, state: sheet.getAttribute("data-atlas-sheet-state"),
      dragging: sheet.getAttribute("data-atlas-sheet-dragging"), bounds: sheet.getBoundingClientRect().toJSON(),
      handle: handle.getBoundingClientRect().toJSON(), inlineHeight: sheet.style.height, inlineMaxHeight: sheet.style.maxHeight,
      previewHeight: sheet.style.getPropertyValue("--atlas-sheet-drag-height"),
      content: content ? { bounds: content.getBoundingClientRect().toJSON(), scrollTop: content.scrollTop,
        scrollHeight: content.scrollHeight, clientHeight: content.clientHeight } : null,
      viewport: { width: innerWidth, height: innerHeight }, country: new URL(location.href).searchParams.get("country"),
      writer: new URL(location.href).searchParams.get("writer"), language: document.documentElement.lang };
    window.__nativePlanetSheetMeasurements.push(result);
    return result;
  }, { selector: countrySheetSelector, phase });
}

async function browserFrames(page, count = 2) {
  await page.evaluate(async count => { for (let index = 0; index < count; index++) await new Promise(resolve => requestAnimationFrame(resolve)); }, count);
}

async function holdTouchStill(page) {
  // A stationary finger for >120ms selects the nearest height, independently
  // of device frame rate or the gesture's separate velocity/fling rule.
  await page.evaluate(() => new Promise(resolve => {
    const started = performance.now();
    const tick = at => at - started >= 160 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }));
}

async function touchAt(session, type, point) {
  await session.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [{ x: point.x, y: point.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] : [] });
}

async function touchSheetTap(page, session) {
  const before = await sheetMeasurement(page, "before-tap");
  const expected = { collapsed: "half", half: "expanded", expanded: "collapsed" }[before.state];
  expect(expected).toBeTruthy();
  const point = { x: before.handle.x + before.handle.width / 2, y: before.handle.y + Math.min(32, before.handle.height / 2) };
  await touchAt(session, "touchStart", point);
  await touchAt(session, "touchEnd");
  await expect(page.locator(countrySheetSelector)).toHaveAttribute("data-atlas-sheet-state", expected);
  await browserFrames(page);
  return sheetMeasurement(page, "after-tap");
}

async function touchSheetDrag(page, session, targetHeight, phase, { finish = true } = {}) {
  const before = await sheetMeasurement(page, phase + "-before");
  const point = { x: before.handle.x + before.handle.width / 2, y: before.handle.y + Math.min(32, before.handle.height / 2) };
  const delta = before.bounds.height - targetHeight;
  expect(Math.abs(delta)).toBeGreaterThan(20);
  await touchAt(session, "touchStart", point);
  const following = [];
  for (const fraction of [0.3, 0.65, 1]) {
    const next = { x: point.x, y: point.y + delta * fraction };
    expect(next.y).toBeGreaterThan(0);
    expect(next.y).toBeLessThan(page.viewportSize().height);
    await touchAt(session, "touchMove", next);
    await browserFrames(page);
    const measured = await sheetMeasurement(page, phase + "-finger-" + fraction);
    expect(measured.dragging).toBe("true");
    expect(measured.state).toBe(before.state);
    expect(Math.abs(measured.bounds.height - (before.bounds.height - delta * fraction))).toBeLessThanOrEqual(2);
    expect(Math.abs(measured.bounds.bottom - before.bounds.bottom)).toBeLessThanOrEqual(2);
    following.push(measured);
  }
  if (finish) {
    await holdTouchStill(page);
    await touchAt(session, "touchEnd");
    await expect(page.locator(countrySheetSelector)).not.toHaveAttribute("data-atlas-sheet-dragging", "true");
  }
  return { before, following };
}

async function openTouchCountry() {
  const safeArea = { top: 59, bottom: 34, left: 0, right: 0 };
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", safeArea, hasTouch: true, isMobile: true, observeSheetGesture: true });
  expect(await fixture.page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches)).toBe(true);
  await showWriter(fixture.page);
  await expect(fixture.page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-camera-phase", "idle");
  return fixture;
}

test("mobile country sheet follows real touch, snaps in both directions and keeps content scrolling separate from the globe", async ({}, testInfo) => {
  const fixture = await openTouchCountry();
  const { page, safeAreaSession: session } = fixture;
  const original = await captureScene(page);
  try {
    const pose = await settledCameraPose(original), sheet = page.locator(countrySheetSelector);
    const snapHeights = {};
    // Calibrate actual public UI states through ordinary touch taps; this also
    // checks tap semantics without importing the gesture hook or its formulas.
    for (let index = 0; index < 3; index++) {
      const current = await sheetMeasurement(page, "tap-calibration-" + index);
      snapHeights[current.state] = current.bounds.height;
      await touchSheetTap(page, session);
    }
    expect(Object.keys(snapHeights).sort()).toEqual(["collapsed", "expanded", "half"]);
    expect(snapHeights.collapsed).toBeLessThan(snapHeights.half);
    expect(snapHeights.half).toBeLessThan(snapHeights.expanded);
    for (let index = 0; await sheet.getAttribute("data-atlas-sheet-state") !== "collapsed"; index++) {
      expect(index).toBeLessThan(3);
      await touchSheetTap(page, session);
    }
    const drags = [];
    for (const state of ["half", "expanded"]) {
      drags.push(await touchSheetDrag(page, session, snapHeights[state], "drag-up-" + state));
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", state);
      await retained(page, original);
      expect(await cameraPose(original)).toEqual(pose);
    }
    await evidence(fixture, testInfo, "native-country-sheet-expanded-ru", { snapHeights, drags, sameCanvasRendererCameraScene: true,
      touchInput: "Chrome CDP touchStart/move/end with hasTouch+isMobile; not a physical native device" });

    const beforeScroll = await sheetMeasurement(page, "before-content-touch-scroll");
    expect(beforeScroll.content.scrollHeight).toBeGreaterThan(beforeScroll.content.clientHeight);
    const content = beforeScroll.content.bounds;
    const visibleBottom = Math.min(content.bottom, beforeScroll.bounds.bottom - 34);
    const point = { x: content.x + content.width * 0.65, y: Math.max(content.y + 90, visibleBottom - 70) };
    await touchAt(session, "touchStart", point);
    for (const distance of [20, 40, 65]) { await touchAt(session, "touchMove", { x: point.x, y: point.y - distance }); await browserFrames(page); }
    await holdTouchStill(page);
    await touchAt(session, "touchEnd");
    await expect.poll(() => sheet.locator(".country-panel:not(.panel-loading)").evaluate(element => element.scrollTop)).toBeGreaterThan(beforeScroll.content.scrollTop + 15);
    const afterScroll = await sheetMeasurement(page, "after-content-touch-scroll");
    expect(afterScroll.state).toBe("expanded");
    expect(afterScroll.dragging).not.toBe("true");
    expect(Math.abs(afterScroll.bounds.height - beforeScroll.bounds.height)).toBeLessThanOrEqual(1);
    await retained(page, original);
    expect(await cameraPose(original)).toEqual(pose);
    for (const state of ["half", "collapsed"]) {
      drags.push(await touchSheetDrag(page, session, snapHeights[state], "drag-down-" + state));
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", state);
    }
    await expect(sheet.locator("#atlas-country-sheet-content")).toHaveAttribute("aria-hidden", "true");
    await expect(sheet.locator("#atlas-country-sheet-content")).toHaveAttribute("inert", "");
    await retained(page, original);
    expect(await cameraPose(original)).toEqual(pose);
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await evidence(fixture, testInfo, "native-country-sheet-return-collapsed", { snapHeights, drags, beforeScroll, afterScroll,
      actualContentScrolled: true, selectedCountry: "russia", selectedWriter: "dostoevsky", unchangedCameraPose: pose });
  } finally { await original.dispose(); }
});

test("mobile country sheet preserves keyboard, touch cancellation, locale and orientation without replacing the scene", async ({}, testInfo) => {
  const fixture = await openTouchCountry();
  const { page, safeAreaSession: session } = fixture;
  const original = await captureScene(page);
  try {
    const sheet = page.locator(countrySheetSelector), handle = sheet.locator(".atlas-country-sheet-toggle");
    const pose = await settledCameraPose(original);
    for (let index = 0; await sheet.getAttribute("data-atlas-sheet-state") !== "collapsed"; index++) {
      expect(index).toBeLessThan(3);
      await touchSheetTap(page, session);
    }
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    await expect(handle).toBeFocused();
    await page.keyboard.press("Space");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "expanded");
    await expect(handle).toBeFocused();
    await touchSheetTap(page, session);
    await touchSheetTap(page, session);
    const half = await sheetMeasurement(page, "before-cancel");
    expect(half.state).toBe("half");
    const cancelledDrag = await touchSheetDrag(page, session, half.bounds.height + 60, "cancelled-drag", { finish: false });
    await touchAt(session, "touchCancel");
    await expect(sheet).not.toHaveAttribute("data-atlas-sheet-dragging", "true");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    const cancelled = await sheetMeasurement(page, "after-touch-cancel");
    expect(Math.abs(cancelled.bounds.height - half.bounds.height)).toBeLessThanOrEqual(2);
    expect(cancelled.inlineHeight).toBe("");
    expect(cancelled.inlineMaxHeight).toBe("");
    expect(cancelled.previewHeight).toBe("");
    await retained(page, original);
    expect(await cameraPose(original)).toEqual(pose);

    await nativeLanguage(page, "en", "tap");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(handle).toHaveAccessibleName("Expand archive fully");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    await retained(page, original);
    expect(await cameraPose(original)).toEqual(pose);
    const interrupted = await touchSheetDrag(page, session, half.bounds.height + 60, "orientation-interrupted-drag", { finish: false });
    await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 21, left: 44, right: 44 } });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(sheet).not.toHaveAttribute("data-atlas-sheet-dragging", "true");
    await touchAt(session, "touchCancel");
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    const landscape = await sheetMeasurement(page, "after-landscape-resize");
    expect(landscape.inlineHeight).toBe("");
    expect(landscape.inlineMaxHeight).toBe("");
    expect(landscape.previewHeight).toBe("");
    expect(landscape.bounds.bottom).toBeLessThanOrEqual(390);
    expect(landscape.handle.y).toBeGreaterThanOrEqual(0);
    await retained(page, original);
    await evidence(fixture, testInfo, "native-country-sheet-landscape-en", { cancelledDrag, cancelled, interrupted, landscape,
      orientationFixture: "Chrome viewport rotation and CSS safe-area override, not an OS rotation observation" });
    await page.setViewportSize({ width: 390, height: 844 });
    await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
    await retained(page, original);
    expect(await settledCameraPose(original)).toEqual(pose);
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await evidence(fixture, testInfo, "native-country-sheet-cancelled-portrait-en", { selectedCountry: "russia", selectedWriter: "dostoevsky",
      locale: "en", keyboardEnterAndSpace: true, pointerCancelRestoredState: true, orientationRestoredState: true,
      sameCanvasRendererCameraScene: true, unchangedPortraitCameraPose: pose });
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
  // Observe natural idle before interaction: the visible Menu must continue
  // to provide genuine language access while reading the invitation.
  await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-quiet", "true");
  await expect(page.locator("[data-planet-welcome]")).toBeVisible();
  const chrome = page.locator(".atlas-immersive-chrome");
  await expect(chrome).toHaveCSS("opacity", "1");
  await expect(chrome).toHaveCSS("transform", "none");
  expect(await chrome.evaluate(element => element.matches(":hover, :focus-within"))).toBe(false);
  const menu = chrome.locator('[data-atlas-action="toggle-menu"]');
  await expect(menu).toBeVisible();
  await expect(menu).toBeInViewport({ ratio: 1 });
  const menuBounds = await menu.boundingBox();
  expect(menuBounds.width).toBeGreaterThanOrEqual(44);
  expect(menuBounds.height).toBeGreaterThanOrEqual(44);
  expect(await menu.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
  const panel = await nativeMenu(page);
  const buttons = panel.locator(".interface-language-control button[data-interface-language]");
  await expect(buttons).toHaveCount(2);
  expect(await buttons.evaluateAll(elements => elements.map(element => element.dataset.interfaceLanguage))).toEqual(["ru", "en"]);
  const observations = [];
  for (const language of ["ru", "en"]) {
    const button = await nativeLanguageButton(page, panel, language);
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
      const result = { language: element.dataset.interfaceLanguage, accessibleName: element.getAttribute("aria-label"),
        bounds: rect.toJSON(), effectiveOpacity,
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
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  // Leave focus on an actual invitation action for the next idle observation.
  await page.locator('[data-planet-welcome-action="journey"]').focus();
  await page.mouse.move(0, 0);
  return { quietBeforeOpening: true, naturalIdleObserved: true, initiallyHoveredOrFocused: false,
    chromeOpacity: 1, chromeTransform: "none", languageAccess: "genuine Menu disclosure",
    menuBounds, menuClosedAfterObservation: true, buttons: observations };
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
        await nativeLanguage(page, language);
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

test("native book author navigation closes the reader and reveals the canonical writer across RU and EN on the retained globe", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=france#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const { page } = fixture;
  const scene = await captureScene(page);
  const key = "russia:dostoevsky:crime-and-punishment";
  const panel = page.locator(".native-planet-panel");
  const detail = panel.locator("#book-archive-detail");
  const writer = page.locator(".writer-detail");
  const observations = [];
  try {
    for (const locale of ["ru", "en"]) {
      if (locale === "en") {
        const pose = await settledCameraPose(scene);
        const before = new URL(page.url());
        await nativeLanguage(page, "en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await retained(page, scene);
        expect(await cameraPose(scene)).toEqual(pose);
        for (const field of ["country", "writer", "book"]) expect(new URL(page.url()).searchParams.get(field)).toBe(before.searchParams.get(field));
      }
      // Dostoevsky is outside this filter. The explicit author destination must
      // reveal him, while opening a search result still retains the active filter.
      await page.locator('[data-atlas-action="toggle-filters"]').click();
      await page.locator('[data-atlas-filter="nobel"]').click();
      await expect(page.locator('[data-atlas-filter="nobel"]')).toHaveAttribute("aria-pressed", "true");
      await page.locator('[data-atlas-action="toggle-search"]').click();
      const title = locale === "ru" ? "Преступление и наказание" : "Crime and Punishment";
      await page.locator("#country-search").fill(title);
      const option = page.locator('#country-results [data-option-key="book:' + key + '"]');
      await expect(option).toHaveAccessibleName(title);
      await option.click();
      await expect(panel).toBeVisible();
      await expect(detail).toBeVisible();
      await expect(detail).toHaveAccessibleName(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(key);
      await expect(page.locator('[data-atlas-filter="nobel"]')).toHaveAttribute("aria-pressed", "true");
      await retained(page, scene);

      const author = detail.locator('[data-book-navigation-origin="book-author"]');
      await expect(author).toHaveAccessibleName(locale === "ru" ? "Открыть автора и страну →" : "Open writer and country →");
      if (locale === "en") {
        // Hold the browser history boundary, not application state. Release the
        // original back operation explicitly after another real native Back.
        await page.evaluate(() => {
          const original = history.back;
          const descriptor = Object.getOwnPropertyDescriptor(history, "back");
          const restore = () => {
            if (descriptor) Object.defineProperty(history, "back", descriptor);
            else delete history.back;
          };
          const gate = { calls: 0, restore, release: () => {
            restore();
            return new Promise(resolve => {
              window.addEventListener("popstate", () => resolve(), { once: true });
              original.call(history);
            });
          } };
          Object.defineProperty(history, "back", { configurable: true, value: () => { gate.calls += 1; } });
          window.__nativeBookAuthorBackGate = gate;
        });
      }
      await author.click();
      await expect(detail).toBeHidden();
      if (locale === "en") {
        await expect.poll(() => page.evaluate(() => window.__nativeBookAuthorBackGate.calls)).toBe(1);
        await page.evaluate(async () => {
          window.__nativePlanetHarness.back();
          // Observe committed frames after the Back event without a timed sleep.
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await expect(panel).toBeVisible();
        await expect(detail).toBeHidden();
        expect(new URL(page.url()).searchParams.get("book")).toBe(key);
        expect(await page.evaluate(() => window.__nativeBookAuthorBackGate.calls)).toBe(1);
        await page.evaluate(() => window.__nativeBookAuthorBackGate.release());
      }
      await expect(panel).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
      await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect(page.locator('[data-atlas-filter="all"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".atlas-country-presentation")).toHaveAttribute("data-atlas-sheet-state", "half");
      // No sheet expansion or focus repair in the test: the navigation owns both.
      await expect(writer.locator("h4")).toContainText(locale === "ru" ? /Достоевск/iu : /Dostoevsky/iu);
      await expect(writer.locator("h4")).toBeInViewport();
      await expect.poll(() => writer.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await expect(page.locator(".country-heading p")).toHaveText(locale === "ru"
        ? "Литературное наследие страны" : "The country’s literary heritage");
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
      await retained(page, scene);
      observations.push({ locale, canonicalBookKey: key, countryId: "russia", writerId: "dostoevsky",
        bookUrlCleared: true, readerAndCollectionClosed: true, restrictiveFilterCleared: true,
        repeatedNativeBackDuringControlledHistoryRestore: locale === "en",
        writerRevealedAndFocusedWithoutManualExpansion: true });
      await evidence(fixture, testInfo, "native-book-author-return-" + locale, { ...observations.at(-1),
        sameCanvasRendererCameraScene: true, actualCanonicalCatalog: true, nativeDeviceObserved: false });
      await expect.poll(() => writer.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    // The actual Russian catalogue gives Zambia a capital, unlike Russia.
    // Select it through the existing country search, then test both locales.
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator("#country-search").fill("Zambia");
    await page.locator('#country-results [data-option-key="country:zambia"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("zambia");
    const sheetToggle = page.locator(".atlas-country-sheet-toggle");
    if (await sheetToggle.getAttribute("aria-expanded") === "false") await sheetToggle.click();
    await expect(page.locator(".country-heading p")).toBeVisible();
    const countryPose = await settledCameraPose(scene);
    const countryAddress = new URL(page.url());
    for (const [locale, phase] of [["en", "initial"], ["ru", "switched"], ["en", "restored"]]) {
      if (phase !== "initial") {
        await nativeLanguage(page, locale);
      }
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(".country-heading p")).toHaveText(locale === "ru"
        ? "Столица: Лусака" : "The country’s literary heritage");
      for (const field of ["country", "writer", "book"]) expect(new URL(page.url()).searchParams.get(field)).toBe(countryAddress.searchParams.get(field));
      expect(await cameraPose(scene)).toEqual(countryPose);
      await retained(page, scene);
      await evidence(fixture, testInfo, "native-book-author-return-zambia-" + locale + "-" + phase, {
        locale, countryId: "zambia", actualSourceCapital: "Лусака", unverifiedEnglishCapitalHidden: locale === "en",
        canonicalSelectionRetained: true, sameCanvasRendererCameraScene: true, nativeDeviceObserved: false });
    }
    expect(fixture.consoleErrors).toEqual([]);
  } finally {
    await page.evaluate(() => {
      window.__nativeBookAuthorBackGate?.restore();
      delete window.__nativeBookAuthorBackGate;
    });
    await scene.dispose();
  }
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
      expect(logoBounds.width).toBe(30);
      expect(logoBounds.height).toBe(30);
      expect(logoBounds.y).toBeGreaterThanOrEqual(safeArea.top);
      expect(logoBounds.x).toBeGreaterThanOrEqual(safeArea.left);
      const headerButtons = page.locator(".atlas-immersive-chrome button:visible");
      await expect(headerButtons).toHaveCount(3);
      expect(await headerButtons.evaluateAll(buttons => buttons.map(button => button.dataset.atlasAction))).toEqual(["toggle-filters", "toggle-search", "toggle-menu"]);
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
    await nativeMenuAction(page, "open-collection");
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


test("mobile globe book search resolves evidence-backed RU and EN titles to the same canonical work", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=france#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const { page } = fixture;
  const original = await captureScene(page);
  const opener = page.locator('[data-atlas-action="toggle-search"]');
  const input = page.locator("#country-search");
  const panel = page.locator(".native-planet-panel");
  const detail = panel.locator("#book-archive-detail");
  // Exact current public works and published titles observed in the a6 canonical
  // audit. The real input/results provide the proof; no search/selection callback
  // or replacement catalog is injected by this case.
  const books = [
    { key: "usa:herman_melville:moby-dick", ru: "Моби Дик, или Белый Кит", en: "Moby-Dick; or, The Whale" },
    { key: "usa:francis_scott_fitzgerald:the-great-gatsby", ru: "Великий Гэтсби", en: "The Great Gatsby" },
    { key: "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial", ru: "Над пропастью во ржи", en: "The Catcher in the Rye" },
    { key: "russia:dostoevsky:crime-and-punishment", ru: "Преступление и наказание", en: "Crime and Punishment" },
  ];
  const selectedBook = books[3];
  const observations = [];
  try {
    for (const locale of ["ru", "en"]) {
      if (locale === "en") {
        const previousUrl = new URL(page.url());
        const pose = await settledCameraPose(original);
        await nativeLanguage(page, "en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await retained(page, original);
        expect(await cameraPose(original)).toEqual(pose);
        for (const key of ["country", "writer", "book"]) expect(new URL(page.url()).searchParams.get(key)).toBe(previousUrl.searchParams.get(key));
      }
      const queryOnlyUrl = page.url();
      await opener.click();
      await expect(input).toBeFocused();
      for (const book of books) {
        const query = locale === "ru" ? book.en : book.ru;
        const visibleTitle = locale === "ru" ? book.ru : book.en;
        await input.fill(query);
        const option = page.locator('#country-results [data-option-key="book:' + book.key + '"]');
        await expect(option).toHaveCount(1);
        await expect(option).toBeVisible();
        await expect(option).toHaveAccessibleName(visibleTitle);
        expect(page.url()).toBe(queryOnlyUrl);
        observations.push({ phase: "result", locale, query, visibleTitle, canonicalBookKey: book.key,
          optionKey: await option.getAttribute("data-option-key") });
      }
      await retained(page, original);
      const selectedOption = page.locator('#country-results [data-option-key="book:' + selectedBook.key + '"]');
      if (locale === "ru") await selectedOption.click();
      else {
        const optionId = await selectedOption.getAttribute("id");
        await input.press("Home");
        for (let step = 0; step < 12 && await input.getAttribute("aria-activedescendant") !== optionId; step++) await input.press("ArrowDown");
        await expect(input).toHaveAttribute("aria-activedescendant", optionId);
        await input.press("Enter");
      }
      const visibleTitle = locale === "ru" ? selectedBook.ru : selectedBook.en;
      await expect(panel).toBeVisible();
      await expect(detail).toBeVisible();
      await expect(detail).toHaveAccessibleName(visibleTitle);
      await expect(detail.getByRole("heading", { level: 3, name: visibleTitle, exact: true })).toBeInViewport();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(selectedBook.key);
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-search-open", "false");
      await retained(page, original);
      const cover = detail.locator(".book-detail-cover img");
      await expect(cover).toHaveCount(1);
      await expect.poll(() => cover.evaluate(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
      const coverProof = await cover.evaluate(image => ({ src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight }));
      await evidence(fixture, testInfo, "native-search-book-" + locale + "-open", { locale,
        query: locale === "ru" ? selectedBook.en : selectedBook.ru, visibleTitle, canonicalBookKey: selectedBook.key,
        cover: coverProof, actualSearchResultActivated: true, sameCanvasRendererCameraScene: true });
      await panel.getByRole("button", { name: locale === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }).click();
      await expect(detail).toBeHidden();
      await expect(panel).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect(page.locator(".atlas-country-presentation")).toHaveAttribute("data-atlas-sheet-state", "collapsed");
      await retained(page, original);
      observations.push({ phase: "return", locale, activatedBookKey: selectedBook.key, closedBookUrl: true,
        selectedCountry: "russia", selectedWriter: "dostoevsky", sameCanvasRendererCameraScene: true });
    }
    expect(fixture.consoleErrors).toEqual([]);
    await evidence(fixture, testInfo, "native-search-book-bilingual-complete", { observations,
      actualCatalog: true, oppositeLocaleQueries: 8, activatedSameBookInBothLocales: selectedBook.key,
      sameCanvasRendererCameraScene: true, nativeDeviceObserved: false });
  } finally { await original.dispose(); }
});

test("mobile globe search resolves canonical opposite-locale author names and patronymics in RU and EN on the retained scene", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=france#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const { page } = fixture;
  const scene = await captureScene(page);
  const key = "russia:dostoevsky:crime-and-punishment";
  const input = page.locator("#country-search");
  const panel = page.locator(".native-planet-panel");
  const observations = [];
  try {
    for (const locale of ["ru", "en"]) {
      if (locale === "en") {
        const pose = await settledCameraPose(scene);
        const before = new URL(page.url());
        await nativeLanguage(page, "en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await retained(page, scene);
        expect(await cameraPose(scene)).toEqual(pose);
        for (const field of ["country", "writer", "book"]) expect(new URL(page.url()).searchParams.get(field)).toBe(before.searchParams.get(field));
      }
      const title = locale === "ru" ? "Преступление и наказание" : "Crime and Punishment";
      const oppositeName = locale === "ru" ? "Fyodor Dostoevsky" : "Фёдор Михайлович Достоевский";
      const writerName = locale === "ru" ? "Фёдор Михайлович Достоевский" : "Fyodor Dostoevsky";
      const queryOnlyUrl = page.url();
      await page.locator('[data-atlas-action="toggle-search"]').click();
      await expect(input).toBeFocused();
      const option = page.locator('#country-results [data-option-key="book:' + key + '"]');
      const writerOption = page.locator('#country-results [data-option-key="writer:russia:dostoevsky"]');
      for (const query of ["Михайлович", "Mikhailovich", oppositeName]) {
        await input.fill(query);
        await expect(option).toHaveCount(1);
        await expect(option).toBeVisible();
        await expect(option).toHaveAccessibleName(title);
        await expect(writerOption).toHaveCount(1);
        await expect(writerOption).toHaveAccessibleName(writerName);
        expect(page.url()).toBe(queryOnlyUrl);
        observations.push({ locale, query, title, canonicalBookKey: key });
      }
      await evidence(fixture, testInfo, "native-author-search-" + locale, { locale, query: oppositeName, title, canonicalBookKey: key,
        canonicalWriterKey: "writer:russia:dostoevsky" });
      await writerOption.click();
      await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      expect(new URL(page.url()).searchParams.get("book")).toBeNull();
      await expect(page.locator(".atlas-country-presentation")).toHaveAttribute("data-atlas-sheet-state", "half");
      await expect(page.locator(".writer-detail h4")).toHaveText(writerName);
      await expect(page.locator(".writer-detail h4")).toBeInViewport();
      await expect(page.locator(".writer-detail")).toBeFocused();
      await retained(page, scene);
      await evidence(fixture, testInfo, "native-author-search-writer-" + locale, { locale, query: oppositeName,
        canonicalWriterKey: "writer:russia:dostoevsky", sameCanvasRendererCameraScene: true });
      await page.locator('[data-atlas-action="toggle-search"]').click();
      await input.fill(oppositeName);
      await expect(option).toHaveAccessibleName(title);
      await option.click();
      const detail = panel.locator("#book-archive-detail");
      await expect(detail).toBeVisible();
      await expect(detail).toHaveAccessibleName(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(key);
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await retained(page, scene);
      await panel.getByRole("button", { name: locale === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }).click();
      await expect(panel).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
    }
    expect(fixture.consoleErrors).toEqual([]);
    await retained(page, scene);
    await evidence(fixture, testInfo, "native-author-search-complete", { observations,
      actualCanonicalCatalog: true, sameCanvasRendererCameraScene: true, nativeDeviceObserved: false });
  } finally { await scene.dispose(); }
});

test("native recent history persists canonical writer and work across RU and EN reload and clears locally", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true, preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  let scene = await captureScene(page);
  const storageKey = "probpera-planet-recent-adult-v1";
  const writerKey = JSON.stringify(["writer", "russia", "dostoevsky", null]);
  const workKey = JSON.stringify(["work", "russia", "dostoevsky", "crime-and-punishment"]);
  const canonicalBookKey = "russia:dostoevsky:crime-and-punishment";
  const panel = page.locator(".native-planet-panel");
  const detail = panel.locator("#book-archive-detail");
  const recent = panel.locator("[data-recent-history]");
  const writerRow = recent.locator("[data-recent-entry=" + JSON.stringify(writerKey) + "]");
  const workRow = recent.locator("[data-recent-entry=" + JSON.stringify(workKey) + "]");
  const readEntries = () => {
    const stored = fixture.preferenceMemory.get(storageKey);
    return stored ? JSON.parse(stored).entries : [];
  };
  const entryKey = entry => JSON.stringify([entry.kind, entry.countryId, entry.writerId, entry.kind === "work" ? entry.workId : null]);
  const assertIdsOnly = entries => {
    expect(entries.length).toBeLessThanOrEqual(20);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual((entry.kind === "work"
        ? ["kind", "countryId", "writerId", "workId", "openedAt"]
        : ["kind", "countryId", "writerId", "openedAt"]).sort());
      expect(Number.isSafeInteger(entry.openedAt)).toBe(true);
      expect(entry.openedAt).toBeGreaterThanOrEqual(0);
    }
  };
  const showHistory = async () => {
    if (!await panel.isVisible()) await nativeMenuAction(page, "open-collection");
    await expect(recent).toHaveCount(1);
    if (await recent.getAttribute("open") === null) await recent.locator("summary").click();
    await expect(recent.locator(".recent-history__content")).toBeVisible();
  };
  const historyAppearance = async () => {
    // Resolve inherited tokens through CSS itself; hex and rgb serialization
    // must not cause false mismatches. The hidden probe never changes layout.
    await page.mouse.move(1, 1);
    const appearance = await recent.evaluate(element => {
      const probe = document.createElement("span");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;color:var(--planet-ink);background-color:var(--planet-surface)";
      element.append(probe);
      const probeStyle = getComputedStyle(probe);
      const palette = { color: probeStyle.color, backgroundColor: probeStyle.backgroundColor };
      probe.remove();
      const panelRect = element.closest(".native-planet-panel").getBoundingClientRect();
      return { palette, buttons: [...element.querySelectorAll("button")].map(button => {
        const style = getComputedStyle(button), rect = button.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(button);
        const textRects = [...range.getClientRects()].filter(item => item.width && item.height);
        return { label: button.textContent, color: style.color, backgroundColor: style.backgroundColor,
          radius: style.borderRadius, minHeight: parseFloat(style.minHeight), height: rect.height,
          scrollWidth: button.scrollWidth, clientWidth: button.clientWidth,
          rowFitsPanel: rect.left >= Math.max(0, panelRect.left) - 1 && rect.right <= Math.min(innerWidth, panelRect.right) + 1,
          textFitsRow: textRects.every(item => item.left >= rect.left - 1 && item.right <= rect.right + 1) };
      }) };
    });
    expect(appearance.buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of appearance.buttons) {
      expect(button.color).toBe(appearance.palette.color);
      expect(button.backgroundColor).toBe(appearance.palette.backgroundColor);
      expect(button.radius).toBe("12px");
      expect(button.minHeight).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1);
      expect(button.rowFitsPanel).toBe(true);
      expect(button.textFitsRow).toBe(true);
    }
    return appearance;
  };
  try {
    // Both records originate from canonical UI, never preloaded history JSON.
    await showWriter(page);
    await expect.poll(() => readEntries().map(entryKey)).toContain(writerKey);
    await page.locator("#writer-biography-russia-tab-works").click();
    await page.locator("#writer-biography-russia-panel-works").getByRole("button", { name: "Книжный архив: Преступление и наказание", exact: true }).click();
    await expect(detail).toHaveAccessibleName("Преступление и наказание");
    await expect(detail).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(canonicalBookKey);
    await expect.poll(() => readEntries().map(entryKey)).toContain(workKey);
    await panel.locator(".book-detail-close").click();
    await expect(detail).toBeHidden();
    await showHistory();
    await expect(recent.locator("summary")).toHaveText("Недавно открытое");
    await expect(writerRow).toContainText(/Достоевск/iu);
    await expect(workRow).toContainText("Преступление и наказание");
    const ruEntries = readEntries();
    assertIdsOnly(ruEntries);
    await retained(page, scene);
    const ruHistoryAppearance = await historyAppearance();
    await evidence(fixture, testInfo, "native-history-ru", { storageKey, entries: ruEntries, historyAppearance: ruHistoryAppearance,
      actualWriterAndWorkOpened: true, sameCanvasRendererCameraScene: true });

    const pose = await settledCameraPose(scene);
    const beforeLocale = fixture.preferenceMemory.get(storageKey);
    await (await nativeLanguageButton(page, panel, "en")).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(recent.locator("summary")).toHaveText("Recently opened");
    await expect(writerRow).toContainText("Dostoevsky");
    await expect(workRow).toContainText("Crime and Punishment");
    expect(fixture.preferenceMemory.get(storageKey)).toBe(beforeLocale);
    expect(await cameraPose(scene)).toEqual(pose);
    await retained(page, scene);
    const enHistoryAppearance = await historyAppearance();
    await evidence(fixture, testInfo, "native-history-en", { storageKey, entries: readEntries(), historyAppearance: enHistoryAppearance,
      localeRelabelsExistingIdsOnly: true, sameCanvasRendererCameraScene: true, pose });

    await panel.getByRole("button", { name: "Return to the planet", exact: true }).click();
    await expect(panel).toBeHidden();
    await page.locator('[data-atlas-action="toggle-filters"]').click();
    await page.locator('[data-atlas-filter="nobel"]').click();
    await expect(page.locator('[data-atlas-filter="nobel"]')).toHaveAttribute("aria-pressed", "true");
    await showHistory();
    await writerRow.click();
    await expect(panel).toBeHidden();
    await expect(page.locator('[data-atlas-filter="all"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".atlas-country-presentation")).toHaveAttribute("data-atlas-sheet-state", "half");
    await expect(page.locator(".writer-detail")).toBeFocused();
    await expect(page.locator(".writer-detail h4")).toBeInViewport();
    await expect(page.locator(".writer-detail h4")).toContainText("Dostoevsky");
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await retained(page, scene);
    await evidence(fixture, testInfo, "native-history-writer-return", { storageKey,
      restrictiveFilterCleared: true, writerFocusedWithoutManualSheetExpansion: true, sameCanvasRendererCameraScene: true });

    const firstDocument = await page.evaluate(() => performance.timeOrigin);
    await scene.dispose(); scene = null;
    await page.reload();
    await nativeRootReady(page);
    expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(firstDocument);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    scene = await captureScene(page);
    await showHistory();
    await expect(writerRow).toContainText("Dostoevsky");
    await expect(workRow).toContainText("Crime and Punishment");
    expect(readEntries().map(entryKey)).toContain(writerKey);
    expect(readEntries().map(entryKey)).toContain(workKey);
    assertIdsOnly(readEntries());
    await workRow.click();
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAccessibleName("Crime and Punishment");
    await expect(detail.getByRole("heading", { level: 3, name: "Crime and Punishment", exact: true })).toBeInViewport();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(canonicalBookKey);
    await retained(page, scene);
    await panel.locator(".book-detail-close").click();
    await expect(detail).toBeHidden();
    await expect(workRow).toBeFocused();
    await expect(workRow).toBeInViewport();
    await retained(page, scene);

    await recent.locator("[data-recent-clear]").click();
    await expect(recent.locator("[data-recent-entry]")).toHaveCount(0);
    await expect.poll(() => readEntries()).toEqual([]);
    await expect.poll(() => JSON.parse(fixture.preferenceMemory.get(storageKey) ?? "null")).toEqual({ v: 1, entries: [] });
    // A neutral fresh address avoids deliberately reopening a writer from the
    // old URL immediately after clearing; no history payload is edited by QA.
    await scene.dispose(); scene = null;
    await page.goto(origin + "/#atlas");
    await nativeRootReady(page);
    scene = await captureScene(page);
    await showHistory();
    await expect(recent.locator("[data-recent-entry]")).toHaveCount(0);
    await expect(recent).toContainText("Writers and works you open will appear here.");
    expect(readEntries()).toEqual([]);
    expect(fixture.consoleErrors).toEqual([]);
    await evidence(fixture, testInfo, "native-history-complete", { storageKey,
      restoredAfterNewDocument: true, historyWorkOpenedCanonicalReader: canonicalBookKey,
      historyWorkReturnFocusPreserved: true, clearedHistoryRemainedEmptyOnNeutralColdStart: true,
      finalEntries: readEntries(), simulatedOsPreferencesOnly: true, actualNativeInstallation: false });
  } finally { await scene?.dispose(); }
});

test("native collections disclose session-only favorites and smart shelves when IndexedDB is unavailable", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas", viewport: { width: 390, height: 844 },
    reducedMotion: "reduce", hasTouch: true, isMobile: true, indexedDBAvailable: false,
    preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  let scene = await captureScene(page);
  const panel = page.locator(".native-planet-panel");
  const detail = panel.locator("#book-archive-detail");
  const status = panel.locator("[data-book-collection-persistence]");
  const shelf = panel.locator("#book-collection-shelf");
  const canonicalBookKey = "russia:dostoevsky:crime-and-punishment";
  const bookButton = panel.locator('.archive-book-detail[data-book-key="' + canonicalBookKey + '"]');
  const noFalseStorageClaim = async () => {
    const text = await panel.innerText();
    for (const claim of ["Личные полки хранятся на этом устройстве", "Умная полка сохранена на этом устройстве",
      "Personal shelves are stored on this device", "Smart shelf saved on this device"]) expect(text).not.toContain(claim);
  };
  const visibleWarningLayout = async () => {
    await status.scrollIntoViewIfNeeded();
    await expect(status).toBeInViewport({ ratio: 1 });
    const layout = await status.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const panelRect = element.closest(".native-planet-panel").getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(element);
      const textRects = [...range.getClientRects()].filter(item => item.width && item.height);
      const left = Math.max(0, panelRect.left), right = Math.min(innerWidth, panelRect.right);
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        elementFitsPanel: rect.left >= left - 1 && rect.right <= right + 1,
        textFitsPanel: textRects.every(item => item.left >= left - 1 && item.right <= right + 1),
        textFitsElement: textRects.every(item => item.left >= rect.left - 1 && item.right <= rect.right + 1),
        textLines: textRects.length, centerUnobstructed: hit === element || element.contains(hit),
        obstructingElement: hit === element || element.contains(hit) ? null : { tag: hit?.tagName, role: hit?.getAttribute("role"), className: hit?.getAttribute("class") } };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.elementFitsPanel).toBe(true);
    expect(layout.textFitsPanel).toBe(true);
    expect(layout.textFitsElement).toBe(true);
    expect(layout.textLines).toBeGreaterThan(0);
    expect(layout.centerUnobstructed, JSON.stringify(layout.obstructingElement)).toBe(true);
    return layout;
  };
  try {
    expect(await page.evaluate(() => typeof window.indexedDB)).toBe("undefined");
    await showWriter(page);
    await page.locator("#writer-biography-russia-tab-works").click();
    await page.locator("#writer-biography-russia-panel-works").getByRole("button", { name: "Книжный архив: Преступление и наказание", exact: true }).click();
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "В избранное", exact: true }).click();
    await expect(detail.getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    await panel.locator(".book-detail-close").click();
    await expect(detail).toBeHidden();
    await expect(status).toHaveAttribute("data-book-collection-persistence", "session-only");
    await expect(status).toHaveText("Личные полки доступны только в текущем сеансе. Они могут исчезнуть после закрытия приложения.");
    await noFalseStorageClaim();

    // Save real current filters through the existing smart-shelf action.
    await panel.locator(".book-shelf-controls__scope select").selectOption("library");
    const collectionSearch = panel.locator('.book-shelf-controls input[role="combobox"]');
    const suggestions = panel.locator('.book-shelf-controls [role="listbox"]');
    await collectionSearch.fill("Достоевский");
    await expect(collectionSearch).toBeFocused();
    await expect(collectionSearch).toHaveAttribute("aria-expanded", "true");
    await expect(suggestions).toBeVisible();
    await collectionSearch.press("ArrowDown");
    const activeOptionId = await collectionSearch.getAttribute("aria-activedescendant");
    expect(activeOptionId).toBeTruthy();
    const activeOption = suggestions.locator("[id=" + JSON.stringify(activeOptionId) + "]");
    await expect(activeOption).toHaveAttribute("role", "option");
    await expect(activeOption).toHaveAttribute("aria-selected", "true");
    await expect(collectionSearch).toBeFocused();
    await collectionSearch.press("Escape");
    await expect(suggestions).toBeHidden();
    await collectionSearch.press("ArrowDown");
    await expect(suggestions).toBeVisible();
    await panel.getByRole("button", { name: "Сохранить как умную полку", exact: true }).click();
    await expect(collectionSearch).toHaveAttribute("aria-expanded", "false");
    await expect(suggestions).toBeHidden();
    await expect.poll(() => shelf.inputValue()).toMatch(/^smart-/u);
    const smartShelfId = await shelf.inputValue();
    await expect(shelf.locator('option[value="' + smartShelfId + '"]')).toHaveCount(1);
    await expect(status).toHaveAttribute("data-book-collection-persistence", "session-only");
    await expect(status).toHaveText("Умная полка доступна в текущем сеансе; сохранение на устройстве недоступно.");
    await noFalseStorageClaim();
    const ruWarningLayout = await visibleWarningLayout();
    await retained(page, scene);
    await evidence(fixture, testInfo, "native-collection-session-ru", { canonicalBookKey, smartShelfId,
      indexedDBUnavailable: true, actualFavoriteAndSmartShelfActions: true, storageWarning: await status.innerText(), warningLayout: ruWarningLayout,
      sameCanvasRendererCameraScene: true });

    const pose = await settledCameraPose(scene);
    await (await nativeLanguageButton(page, panel, "en")).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(shelf).toHaveValue(smartShelfId);
    await expect(status).toHaveText("Smart shelf is available in this session; saving on this device is unavailable.");
    await expect(collectionSearch).toHaveAttribute("aria-expanded", "false");
    await expect(suggestions).toBeHidden();
    await noFalseStorageClaim();
    expect(await cameraPose(scene)).toEqual(pose);
    await retained(page, scene);
    const enWarningLayout = await visibleWarningLayout();
    await evidence(fixture, testInfo, "native-collection-session-en", { canonicalBookKey, smartShelfId,
      indexedDBUnavailable: true, storageWarning: await status.innerText(), warningLayout: enWarningLayout, sameCanvasRendererCameraScene: true, pose });

    await bookButton.click();
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAccessibleName("Crime and Punishment");
    await expect(detail.getByRole("button", { name: "In favourites", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(canonicalBookKey);
    await retained(page, scene);
    await scene.dispose(); scene = null;
    await page.reload();
    await nativeRootReady(page);
    scene = await captureScene(page);
    expect(await page.evaluate(() => typeof window.indexedDB)).toBe("undefined");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAccessibleName("Crime and Punishment");
    await expect(detail.getByRole("button", { name: "Add to favourites", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(shelf.locator('option[value="' + smartShelfId + '"]')).toHaveCount(0);
    await expect(shelf).not.toHaveValue(smartShelfId);
    await noFalseStorageClaim();
    expect(fixture.consoleErrors).toEqual([]);
    await evidence(fixture, testInfo, "native-collection-session-complete", { canonicalBookKey, smartShelfId,
      indexedDBUnavailable: true, currentSessionFavoriteAndShelfRetainedAcrossLocale: true,
      disclosedFavoriteAndShelfLossOnNewDocumentObserved: true, noInjectedCollectionStore: true, actualNativeInstallation: false });
  } finally { await scene?.dispose(); }
});

test("compact premium mobile chrome retains the actual globe across menu, locale and edition controls", async ({}, testInfo) => {
  test.setTimeout(180_000);
  const safeArea = { top: 24, bottom: 16, left: 0, right: 0 };
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas",
    viewport: { width: 330, height: 844 }, reducedMotion: "reduce", hasTouch: true, isMobile: true,
    safeArea, preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  const header = page.locator(".atlas-immersive-chrome");
  const globe = page.locator("#atlas .literary-globe");
  const filters = header.locator('[data-atlas-action="toggle-filters"]');
  const search = header.locator('[data-atlas-action="toggle-search"]');
  const menu = header.locator('[data-atlas-action="toggle-menu"]');
  const popup = header.locator("[data-atlas-application-menu-panel]");
  const selector = page.locator(".globe-edition-compact-select select");
  const observations = [];
  const selection = () => {
    const url = new URL(page.url());
    return { country: url.searchParams.get("country"), writer: url.searchParams.get("writer"),
      book: url.searchParams.get("book"), hash: url.hash };
  };
  const canonicalSelection = selection();
  expect(canonicalSelection).toEqual({ country: "russia", writer: "dostoevsky", book: null, hash: "#atlas" });

  async function collapseCountrySheet() {
    const sheet = page.locator('.atlas-country-presentation[data-atlas-country="russia"]');
    const toggle = sheet.locator(".atlas-country-sheet-toggle");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", /^(?:collapsed|half|expanded)$/u);
    // The product hides playback behind an open country sheet. Reach its
    // collapsed state through the real toggle without altering the deep link.
    for (let taps = 0; taps < 2; taps++) {
      const phase = await sheet.getAttribute("data-atlas-sheet-state");
      if (phase === "collapsed") break;
      await toggle.tap();
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", phase === "half" ? "expanded" : "collapsed");
    }
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(selection()).toEqual(canonicalSelection);
  }
  await collapseCountrySheet();
  const original = await captureScene(page);

  async function exposed(target, label) {
    await expect(target, label).toBeVisible();
    // Popup content may use its normal scrollport on short screens. This only
    // exposes the actual target; activation below uses genuine browser input.
    await target.scrollIntoViewIfNeeded();
    await expect(target, label).toBeInViewport({ ratio: 1 });
    const measured = await target.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const points = [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85]];
      return { label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
        bounds: rect.toJSON(), viewport: { width: innerWidth, height: innerHeight }, ownHits: points.map(([x, y]) => {
          const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
          return hit === element || Boolean(hit && element.contains(hit));
        }) };
    });
    expect(measured.bounds.width, label + " touch width").toBeGreaterThanOrEqual(44);
    expect(measured.bounds.height, label + " touch height").toBeGreaterThanOrEqual(44);
    expect(measured.bounds.left, label + " safe left").toBeGreaterThanOrEqual(safeArea.left - 1);
    expect(measured.bounds.top, label + " safe top").toBeGreaterThanOrEqual(safeArea.top - 1);
    expect(measured.bounds.right, label + " safe right").toBeLessThanOrEqual(measured.viewport.width - safeArea.right + 1);
    expect(measured.bounds.bottom, label + " safe bottom").toBeLessThanOrEqual(measured.viewport.height - safeArea.bottom + 1);
    expect(measured.ownHits, label + " own hit points").toEqual([true, true, true, true, true]);
    return measured;
  }
  async function openMenu() {
    await menu.tap();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(popup).toBeVisible();
    await expect.poll(() => popup.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  async function preserved() {
    await retained(page, original);
    expect(selection()).toEqual(canonicalSelection);
  }
  async function selectedMenuLanguage(language) {
    const buttons = popup.locator(".interface-language-control button[data-interface-language]");
    await expect(buttons).toHaveCount(2);
    await expect(popup.locator('.interface-language-control button[data-interface-language][aria-pressed="true"]')).toHaveCount(1);
    for (const locale of ["ru", "en"]) {
      await expect(popup.locator('[data-interface-language="' + locale + '"]'))
        .toHaveAttribute("aria-pressed", String(locale === language));
    }
  }
  async function menuLanguageFlags() {
    await selectedMenuLanguage(await page.locator("html").getAttribute("lang"));
    const flags = [];
    for (const locale of ["ru", "en"]) {
      const button = await nativeLanguageButton(page, popup, locale);
      const target = await exposed(button, "submenu " + locale + " flag");
      const image = button.locator("img");
      const code = locale === "ru" ? "ru" : "gb";
      await expect(image).toHaveCount(1);
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("src", new RegExp("/assets/country-flags/" + code + "\\.svg$", "u"));
      await expect(image).toHaveAttribute("alt", "");
      await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
      const flag = await image.evaluate(element => ({ src: element.getAttribute("src"),
        naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight }));
      flags.push({ locale, target, flag });
    }
    return flags;
  }

  try {
    for (const viewport of [{ width: 320, height: 844 }, { width: 330, height: 844 },
      { width: 390, height: 844 }, { width: 430, height: 844 }, { width: 390, height: 480 },
      { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await nativeRootReady(page);
      await collapseCountrySheet();
      await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
      const pose = await settledCameraPose(original);
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(popup).toBeHidden();
      await expect(header.getByRole("button")).toHaveCount(3);
      await expect(header.locator(".interface-language-control")).toHaveCount(1);
      await expect(header.locator(".interface-language-control")).toBeHidden();
      for (const action of [filters, search, menu]) expect(await action.getAttribute("aria-label")).toBeTruthy();
      const actions = [];
      for (const [target, label] of [[filters, "visible Filters"], [search, "visible Search"], [menu, "visible Menu"]]) {
        actions.push(await exposed(target, label));
      }
      expect(Math.max(...actions.map(action => action.bounds.y)) - Math.min(...actions.map(action => action.bounds.y))).toBeLessThanOrEqual(2);
      const logo = header.locator(".atlas-immersive-identity > img");
      await expect(logo).toBeVisible();
      expect(await logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

      await openMenu();
      const languageFlags = await menuLanguageFlags();
      if (viewport.width === 390 && viewport.height === 844) {
        await evidence(fixture, testInfo, "compact-mobile-flags-menu-390x844", { viewport, safeArea, languageFlags,
          submenuOpen: true, selectedLanguage: "ru", canonicalSelection, nativeDeviceObserved: false });
      }
      await exposed(popup.locator('[data-atlas-action="open-collection"]'), "submenu Collection");
      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
      await expect(menu).toBeFocused();
      await preserved();
      expect(await cameraPose(original)).toEqual(pose);

      if (viewport.width === 330) {
        await openMenu();
        const appearance = popup.locator('[data-atlas-action="open-appearance"]');
        await exposed(appearance, "submenu Appearance");
        await appearance.tap();
        const standPanel = page.locator("[data-planet-stand-panel]");
        await expect(standPanel).toBeVisible();
        await expect(standPanel.locator("h2")).not.toBeEmpty();
        await expect(standPanel.locator("[data-planet-stand-select]")).toBeFocused();
        await expect(popup).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(standPanel).toBeHidden();
        await expect(menu).toBeFocused();
        await preserved();
        expect(await settledCameraPose(original)).toEqual(pose);
      }

      const locales = [];
      for (const locale of ["en", "ru"]) {
        await openMenu();
        const language = await nativeLanguageButton(page, popup, locale);
        locales.push({ locale, target: await exposed(language, "submenu " + locale.toUpperCase()) });
        await language.tap();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect.poll(() => page.evaluate(() => window.__nativePlanetHarness.savedLanguage())).toBe(locale);
        await selectedMenuLanguage(locale);
        await expect(popup).toBeHidden();
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await expect(menu).toBeFocused();
        await preserved();
        expect(await cameraPose(original)).toEqual(pose);
      }

      // Verify the real header handoff while the submenu owns focus/backdrop.
      await openMenu();
      await search.tap();
      const input = page.locator("#country-search");
      await expect(input).toBeFocused();
      await expect(search).toHaveAttribute("aria-expanded", "true");
      await expect(popup).toBeHidden();
      await input.press("Escape");
      await expect(search).toHaveAttribute("aria-expanded", "false");
      await expect(search).toBeFocused();
      await preserved();

      await filters.tap();
      await expect(filters).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(filters).toHaveAttribute("aria-expanded", "false");
      await expect(filters).toBeFocused();
      await preserved();

      await openMenu();
      await popup.locator('[data-atlas-action="open-collection"]').tap();
      const collection = page.locator(".native-planet-panel");
      await expect(collection).toBeVisible();
      const returnToGlobe = collection.getByRole("button", { name: /^(?:Вернуться к планете|Return to the planet)$/u });
      await exposed(returnToGlobe, "Collection return");
      if (viewport.width === 390 && viewport.height === 844) {
        const archive = collection.locator('.book-archive-heading');
        const tools = collection.locator('#native-collection-tools');
        const shortcut = collection.locator('[data-native-collection-tools-shortcut]');
        await expect(archive).toBeVisible();
        await expect(collection.locator('.native-book-archive-intro')).toHaveText('Находите книги, сохраняйте избранное и собирайте собственные полки.');
        expect(await archive.evaluate((node, id) => Boolean(node.compareDocumentPosition(document.getElementById(id)) & Node.DOCUMENT_POSITION_FOLLOWING), 'native-collection-tools')).toBe(true);
        const about = collection.locator('.native-book-archive-about');
        await expect(about).not.toHaveAttribute('open', '');
        await about.locator('summary').tap();
        await expect(about.locator('p')).toContainText('редакционной проверки');
        await about.locator('summary').tap();
        await evidence(fixture, testInfo, 'premium-collection-ru-390x844', { contentBeforeUtilities: true, originalEditorialDescriptionRetained: true });
        await exposed(shortcut, 'Collection settings shortcut'); await shortcut.tap();
        await expect(tools).toBeFocused(); await expect(tools.locator('h2')).toBeInViewport();
        const downloads = tools.locator('[data-planet-downloads]');
        await downloads.locator('summary').tap();
        await expect(downloads).toContainText('Дополнительных пакетов для загрузки пока нет.');
        await evidence(fixture, testInfo, 'premium-collection-tools-390x844', { genuineShortcutFocusAndScroll: true, actualDownloads: true });
        await downloads.locator('summary').tap();
        await (await nativeLanguageButton(page, collection, 'en')).tap();
        await expect(collection.locator('.native-book-archive-intro')).toHaveText('Discover books, save favourites and create your own shelves.');
        await expect(shortcut).toHaveText('Settings and help');
        expect(selection()).toEqual(canonicalSelection);
        await collection.locator('.native-planet-panel__content').evaluate(node => node.scrollTo({ top: 0, behavior: 'instant' }));
        await evidence(fixture, testInfo, 'premium-collection-en-390x844', { locale: 'en', actualArchiveRetained: true });
        await (await nativeLanguageButton(page, collection, 'ru')).tap();
      }
      await returnToGlobe.tap();
      await expect(collection).toBeHidden();
      await expect(menu).toBeFocused();
      await expect(popup).toBeHidden();
      await collapseCountrySheet();
      await preserved();
      expect(await settledCameraPose(original)).toEqual(pose);

      await openMenu();
      const source = popup.locator('[data-atlas-action="globe-source"]');
      await exposed(source, "submenu Source and rights");
      await source.tap();
      const dialog = page.locator(".globe-edition-info-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("open", "");
      await expect(dialog.locator("#globe-edition-info-title")).not.toBeEmpty();
      expect(await dialog.locator("dl dt").count()).toBeGreaterThanOrEqual(4);
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(menu).toBeFocused();
      await expect(popup).toBeHidden();
      await preserved();
      expect(await cameraPose(original)).toEqual(pose);

      const editionControl = await exposed(selector, "compact edition selector");
      await expect(selector).toHaveAccessibleName(/издани|edition/iu);
      const previousEdition = await globe.getAttribute("data-globe-edition");
      const nextEdition = previousEdition === "nasa-blue-marble" ? "rand-mcnally-1887" : "nasa-blue-marble";
      await selector.selectOption(nextEdition);
      await expect(globe).toHaveAttribute("data-globe-edition", nextEdition);
      await expect(globe).toHaveAttribute("data-globe-edition-transition", "idle");
      await expect(selector).toHaveValue(nextEdition);
      await expect(selector).toBeEnabled();
      await preserved();
      expect(await settledCameraPose(original)).toEqual(pose);

      const controls = {};
      for (const name of ["zoom-in", "zoom-out", "reset", "auto-rotate"]) {
        controls[name] = await exposed(globe.locator('[data-globe-control="' + name + '"]'), name);
      }
      expect(Math.abs(controls["zoom-in"].bounds.x - controls["zoom-out"].bounds.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(controls["zoom-out"].bounds.x - controls.reset.bounds.x)).toBeLessThanOrEqual(2);
      expect(controls["zoom-in"].bounds.bottom).toBeLessThanOrEqual(controls["zoom-out"].bounds.top);
      expect(controls["zoom-out"].bounds.bottom).toBeLessThanOrEqual(controls.reset.bounds.top);
      expect(controls["auto-rotate"].bounds.right).toBeLessThan(controls["zoom-in"].bounds.left);
      await expect(globe.locator('[data-globe-control="auto-rotate"]')).toBeDisabled();
      await expect(globe).toHaveAttribute("data-globe-auto-rotate", "reduced-motion");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await preserved();
      const observation = { viewport, safeArea, actions, languageFlags, locales, controls, editionControl, committedEdition: nextEdition,
        selectedCountry: "russia", selectedWriter: "dostoevsky", sameCanvasRendererCameraScene: true,
        focusReturns: ["Menu Escape", "locale", "Search Escape", "Filters Escape", "Collection return", "Source Escape", ...(viewport.width === 330 ? ["Appearance Escape"] : [])],
        sheetPreparation: "Actual country toggle taps to collapsed; URL retained",
        nativeOsPopupCaptured: false, nativeDeviceObserved: false };
      observations.push(observation);
      await evidence(fixture, testInfo, "compact-mobile-" + viewport.width + "x" + viewport.height, observation);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await openMenu();
    await exposed(popup.locator('[data-atlas-action="open-collection"]'), 'Menu Collection at 200 percent text');
    await menuLanguageFlags();
    await expect(popup.locator('[data-atlas-action="open-collection"]')).toHaveCSS('white-space', 'normal');
    await evidence(fixture, testInfo, 'premium-menu-large-text-390x844', { rootFontScale: '200%', exposedFlags: true, actualMenu: true });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.documentElement.style.removeProperty('font-size'); });
    await preserved();
    const beforeZoom = await settledCameraPose(original);
    const zoomIn = globe.locator('[data-globe-control="zoom-in"]');
    await exposed(zoomIn, "touch zoom in");
    await zoomIn.tap();
    await expect.poll(() => cameraPose(original)).not.toEqual(beforeZoom);
    const zoomedPose = await settledCameraPose(original);
    expect(Math.hypot(...zoomedPose.position)).toBeLessThan(Math.hypot(...beforeZoom.position));
    await preserved();
    const reset = globe.locator('[data-globe-control="reset"]');
    await exposed(reset, "touch reset");
    await reset.tap();
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    const resetPose = await settledCameraPose(original);
    expect(resetPose).not.toEqual(zoomedPose);
    await preserved();
    await evidence(fixture, testInfo, "compact-mobile-touch-zoom-reset", { beforeZoom, zoomedPose, resetPose,
      actualTouchActions: ["zoom-in", "reset"], sameCanvasRendererCameraScene: true, canonicalSelection });
    const bookyGeometry = await page.locator('.planet-mascot-controls[data-planet-mascot-active="false"] > .planet-mascot-controls__show').evaluate(button => {
      const root = button.parentElement, rect = button.getBoundingClientRect(), view = visualViewport;
      return { root: root.getBoundingClientRect().toJSON(), button: rect.toJSON(), left: root.style.left,
        rootFont: getComputedStyle(document.documentElement).fontSize, font: getComputedStyle(button).font,
        clientWidth: document.documentElement.clientWidth, innerWidth, view: { width: view?.width, offsetLeft: view?.offsetLeft, scale: view?.scale },
        ownHits: [[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]].map(([x,y]) => {
          const hit = document.elementFromPoint(rect.left + rect.width*x,rect.top + rect.height*y);
          return hit===button || Boolean(hit&&button.contains(hit));
        }) };
    });
    await evidence(fixture, testInfo, "booky-actual-history-text-return", { bookyGeometry, actualNativeInstallation: false });
    expect(bookyGeometry.button.right, 'Booky actual-history visible right').toBeLessThanOrEqual(391);
    expect(bookyGeometry.button.width, 'Booky actual-history touch width').toBeGreaterThanOrEqual(44);
    expect(bookyGeometry.button.height, 'Booky actual-history touch height').toBeGreaterThanOrEqual(44);
    expect(bookyGeometry.ownHits, 'Booky actual-history own hit points').toEqual([true,true,true,true,true]);
    expect(fixture.consoleErrors).toEqual([]);
    await testInfo.attach("compact-mobile-observations", { body: JSON.stringify(observations), contentType: "application/json" });
  } finally { await original.dispose(); }
});

test("hidden Booky trigger remains exposed after the real Menu large-text round trip", async ({}, testInfo) => {
  const fixture = await open({ route: "/?country=russia&writer=dostoevsky#atlas",
    viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true, isMobile: true,
    safeArea: { top: 24, bottom: 16, left: 0, right: 0 },
    preferences: { "probpera-planet-welcome-v1": "completed" } });
  const { page } = fixture;
  const trigger = page.locator('.planet-mascot-controls[data-planet-mascot-active="false"] > .planet-mascot-controls__show');
  const original = await captureScene(page);
  const observations = [];
  async function geometry(phase) {
    return trigger.evaluate((button, phase) => {
      const root = button.parentElement, view = visualViewport;
      const rect = button.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
      const buttonStyle = getComputedStyle(button), rootStyle = getComputedStyle(root);
      const points = [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85]];
      return { phase, language: document.documentElement.lang,
        rootFont: getComputedStyle(document.documentElement).fontSize,
        viewport: { left: view?.offsetLeft ?? 0, top: view?.offsetTop ?? 0,
          width: view?.width ?? innerWidth, height: view?.height ?? innerHeight, scale: view?.scale ?? 1 },
        layoutViewport: { width: innerWidth, height: innerHeight,
          clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight },
        root: { bounds: rootRect.toJSON(), inlineLeft: root.style.left, computedLeft: rootStyle.left,
          computedWidth: rootStyle.width, visibility: root.getAttribute("data-planet-mascot-visibility") },
        trigger: { bounds: rect.toJSON(), font: buttonStyle.font, computedWidth: buttonStyle.width,
          ownHits: points.map(([x, y]) => {
            const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
            return hit === button || Boolean(hit && button.contains(hit));
          }) } };
    }, phase);
  }
  function exposed(record) {
    const { bounds, ownHits } = record.trigger, view = record.viewport;
    expect(bounds.width, record.phase + " touch width").toBeGreaterThanOrEqual(44);
    expect(bounds.height, record.phase + " touch height").toBeGreaterThanOrEqual(44);
    expect(bounds.left, record.phase + " visible left").toBeGreaterThanOrEqual(view.left - 1);
    expect(bounds.right, record.phase + " visible right").toBeLessThanOrEqual(Math.min(view.left + view.width, record.layoutViewport.clientWidth) + 1);
    expect(bounds.top, record.phase + " visible top").toBeGreaterThanOrEqual(view.top - 1);
    expect(bounds.bottom, record.phase + " visible bottom").toBeLessThanOrEqual(view.top + view.height + 1);
    expect(ownHits, record.phase + " own hit points").toEqual([true, true, true, true, true]);
  }
  try {
    const sheet = page.locator('.atlas-country-presentation[data-atlas-country="russia"]');
    const sheetToggle = sheet.locator(".atlas-country-sheet-toggle");
    for (let taps = 0; taps < 2; taps++) {
      const phase = await sheet.getAttribute("data-atlas-sheet-state");
      if (phase === "collapsed") break;
      await sheetToggle.tap();
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", phase === "half" ? "expanded" : "collapsed");
    }
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toBeVisible();
    await settledCameraPose(original);
    const initial = await geometry("before-large-text"); observations.push(initial);
    await evidence(fixture, testInfo, "booky-before-large-text", { observations, actualNativeInstallation: false });
    exposed(initial);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const popup = await nativeMenu(page, "tap");
    await expect(popup.locator('[data-atlas-action="open-collection"]')).toBeInViewport({ ratio: 1 });
    observations.push(await geometry("large-text-menu-open"));
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]')).toBeFocused();
    await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
    observations.push(await geometry("immediately-after-text-restore"));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    observations.push(await geometry("after-two-animation-frames"));
    await settledCameraPose(original);
    let previous, current, stable = 0;
    await expect.poll(async () => {
      current = await geometry("settled-after-text-restore");
      const signature = JSON.stringify([current.viewport, current.root.bounds, current.trigger.bounds, current.rootFont, current.trigger.font]);
      stable = signature === previous ? stable + 1 : 0; previous = signature;
      return stable;
    }, { intervals: [100, 200, 300], timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    observations.push(current);
    await retained(page, original);
    await evidence(fixture, testInfo, "booky-after-text-roundtrip", { observations,
      single390Viewport: true, noCompanionActivation: true, actualNativeInstallation: false });
    exposed(current);
    await page.setViewportSize({ width: 330, height: 844 });
    await nativeLanguage(page, 'en', 'tap');
    await settledCameraPose(original);
    await expect(trigger).toHaveText('Mr. Booky');
    const english = await geometry('english-narrow-return-shortcut'); observations.push(english);
    await evidence(fixture, testInfo, 'booky-english-narrow-return-shortcut', { observations,
      noCompanionActivation: true, actualNativeInstallation: false });
    exposed(english);
    await retained(page, original);
  } finally {
    await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
    await original.dispose();
  }
});
