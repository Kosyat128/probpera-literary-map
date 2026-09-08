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
      const memory=new Map([['probpera-interface-language',initial.language]]);
      const handles=[];
      const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
      const bindings={
        core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
        app:{getAppLanguage:async()=>({value:initial.language==='ru'?'ru-RU':'en-US'}),getState:async()=>({isActive:true}),getLaunchUrl:async()=>undefined,addListener:subscribe},
        network:{getStatus:async()=>({connected:true}),addListener:subscribe},
        preferences:{get:async({key})=>({value:memory.get(key)??null}),set:async({key,value})=>{memory.set(key,value)},remove:async({key})=>{memory.delete(key)}},
        browser:{open:async()=>{throw Error('External browser unavailable in the native source fixture')}},
        appLauncher:{openUrl:async()=>({completed:false})}
      };
      window.__nativePlanetHarness={
        scenes:()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene}}),
        savedLanguage:()=>memory.get('probpera-interface-language'),
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
    nativePlugins: "injected Android OS boundary", actualApp: true, actualCss: true,
    publicAssetSelectionSha256: digest(selectionBytes), selectedPublicAssets: selection.files.length,
    viteGlobTransform,
    bundledFiles: result.outputFiles.map(file => ({ path: path.relative(memoryOutput, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    nativeDeviceObserved: false, releaseReady: false,
  };
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });
test.afterEach(async ({}, testInfo) => {
  for (const fixture of activeFixtures) {
    try { await captureEvidence(fixture, testInfo, "native-final-" + testInfo.status); }
    finally { await fixture.page.close(); activeFixtures.delete(fixture); }
  }
});

async function open({ route = "/", language = "ru", viewport = { width: 1280, height: 800 }, reducedMotion = "reduce", safeArea } = {}) {
  const page = await browser.newPage({ viewport, reducedMotion });
  page.setDefaultTimeout(15_000);
  const errors = [], consoleErrors = [], externalRequests = [], missingResources = [];
  const fixture = { page, errors, consoleErrors, externalRequests, missingResources };
  activeFixtures.add(fixture);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  if (safeArea) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeArea });
  }
  await page.addInitScript(value => {
    window.__nativePlanetInitial = value;
    window.__nativePlanetVisibleHeroFrames = 0;
    const observe = () => {
      const hero = document.querySelector(".magazine-hero");
      if (hero) { const rect = hero.getBoundingClientRect(); const style = getComputedStyle(hero); if (rect.width && rect.height && style.display !== "none" && style.visibility !== "hidden") window.__nativePlanetVisibleHeroFrames++; }
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
  await expect(page.locator(".native-planet-app")).toBeVisible();
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator('#atlas .literary-globe[data-globe-webgl-context="ready"]')).toBeVisible();
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".magazine-hero")).toHaveCount(0);
  return fixture;
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
        canvasCount: document.querySelectorAll("#atlas canvas").length,
        documentCanvasCount: document.querySelectorAll("canvas").length,
        native: describe(".native-planet-app, .native-planet-launch, .native-planet-panel"),
        archive: describe("#books, #book-archive-detail, .stage5-deferred-books, [data-requested-book], #books [role=status], #books [role=alert]"),
      };
    });
  } catch (error) { runtime = { diagnosticError: error.message }; }
  await testInfo.attach(name, { body: JSON.stringify({ ...sourceEvidence, ...extra, runtime, errors: fixture.errors, consoleErrors: fixture.consoleErrors, externalRequests: fixture.externalRequests, missingResources: fixture.missingResources }), contentType: "application/json" });
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
