import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Actual App, native source entry, CSS, country data, textures and R3F scene.
// Native OS plugins are controlled ports. This is antique tier-switch source
// evidence, not an installed device, all-edition stress or a global leak proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://globe-antique-detail.test";
const ANTIQUE = "rand-mcnally-1887";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" };
let files, selectedAssets, sourceEvidence;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(root, ".tmp/globe-antique-detail-memory");
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
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__editionBootstrapError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: "antique-detail", assetNames: "assets/[name]-[hash]",
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
    "src/components/GlobeCameraRig.tsx", "src/components/globeAtlas.ts", "src/host/PlanetGraphicsSettings.tsx"]) {
    expect(inputs, "The canonical component must remain in the source graph").toContain(module);
  }
  files = new Map(built.outputFiles.map(file => ["/fixture/" + path.relative(output, file.path).replaceAll("\\", "/"), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(root, "scripts/mobile/native-base-assets.json"));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== "public/" + entry.output || entry.transformation !== "none" || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error("Invalid selected native asset");
    return ["/" + entry.output, entry];
  }));
  sourceEvidence = { kind: "canonical-app-antique-detail-in-Chrome", actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ["native OS plugins"], observation: "Actual frame geometries and disposal events; no production probes",
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll("\\", "/"), sha256: digest(file.contents) })),
    installedNative: false, entitlementGranted: false, releaseReady: false };
});

async function open(testInfo) {
  const profileRoot = path.resolve(process.env.S13_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s13-antique-detail"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "ad-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  const memory = new Map([["probpera-interface-language", "ru"], ["probpera-planet-welcome-v1", "completed"]]);
  const errors = [], externalRequests = [], missingResources = [];
  const result = { ...sourceEvidence, pass: false, observations: [], totalStressSwitches: 30,
    limitations: ["Thirty explicit quality changes on the existing antique edition only.",
      "Global renderer counters are diagnostics; disposal assertions cover the identified frame resources only."] };
  page.on("pageerror", error => errors.push(error.message));
  await page.exposeBinding("__osPreference", (_source, operation, key, value) => {
    if (operation === "get") return memory.get(key) ?? null;
    if (operation === "set") { memory.set(key, value); return; }
    if (operation === "remove") { memory.delete(key); return; }
    throw Error("Unknown native preference fixture operation");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === "document" && url.pathname === "/") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/antique-detail.css"></head><body><div id="root"></div><script src="/fixture/antique-detail.js"></script></body></html>' }); return;
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
    await page.goto(origin + "/?country=russia&writer=dostoevsky#atlas");
    await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".native-planet-launch")).toBeHidden();
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.evaluate(() => window.__editionBootstrapError ?? null)).toBeNull();
    return { page, result, verify() {
      expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]); result.pass = true;
    }, async close() {
      result.disposalLedger = await page.evaluate(() => window.__antiqueProbe?.ledger() ?? []);
      result.errors = errors; result.externalRequests = externalRequests; result.missingResources = missingResources;
      await fs.writeFile(testInfo.outputPath("globe-antique-detail.json"), JSON.stringify(result, null, 2) + "\n");
      await page.evaluate(() => window.__antiqueProbe?.disconnect());
      await context.close();
    } };
  } catch (error) { await context.close(); throw error; }
}

async function installProbe(page) {
  await page.evaluate(() => {
    const original = window.__editionScene.scenes().find(value => document.querySelector("#atlas").contains(value.canvas));
    if (!original) throw Error("Missing canonical scene");
    const geometries = new Map(), staticIds = new Map();
    let currentIds = new Set();
    const watch = (geometry, kind) => {
      if (!geometries.has(geometry.uuid)) {
        const record = { geometry, kind, disposals: 0, listener: () => { record.disposals++; } };
        geometry.addEventListener("dispose", record.listener); geometries.set(geometry.uuid, record);
      }
    };
    const signature = geometry => {
      const arrays = [...Object.keys(geometry.attributes).sort().map(key => geometry.attributes[key].array),
        ...(geometry.index ? [geometry.index.array] : [])];
      let hash = 2166136261, bytes = 0;
      for (const array of arrays) {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); bytes += view.byteLength;
        for (const byte of view) hash = Math.imul(hash ^ byte, 16777619);
      }
      return { vertices: geometry.getAttribute("position").count, indices: geometry.index?.count ?? 0,
        bytes, fingerprint: (hash >>> 0).toString(16) };
    };
    const ledger = () => [...geometries].map(([uuid, value]) => ({ uuid, kind: value.kind, disposals: value.disposals,
      current: currentIds.has(uuid), static: value.kind.startsWith("static:") }));
    const sample = () => {
      const active = window.__editionScene.scenes().find(value => value.canvas === original.canvas);
      const roots = [];
      original.scene.traverse(object => {
        const p = object.geometry?.parameters;
        if (object.isMesh && object.geometry.type === "TorusGeometry" && p.radius === 1.09 && p.tube === 0.014) roots.push(object.parent);
      });
      if (roots.length !== 1) throw Error("Expected one canonical antique frame");
      const frame = roots[0];
      const whales = frame.children.filter(child => child.isGroup && child.children.some(object =>
        object.geometry?.type === "BufferGeometry" && object.geometry.getAttribute("position").count > 36));
      if (whales.length !== 3) throw Error("Expected three canonical bronze whales");
      const bodies = whales.map(whale => whale.children.find(object =>
        object.geometry?.type === "BufferGeometry" && object.geometry.getAttribute("position").count > 36).geometry);
      if (new Set(bodies).size !== 1) throw Error("Whales must share one body geometry");
      const variable = [{ kind: "body", geometry: bodies[0], instances: 3 }];
      for (const object of frame.children) {
        if (object.geometry?.type !== "TorusGeometry") continue;
        const p = object.geometry.parameters;
        variable.push({ kind: (p.tube === 0.0035 ? "base:" : "ring:") + p.radius, geometry: object.geometry, instances: 1 });
      }
      if (variable.length !== 6) throw Error("Expected one body and five frame rings");
      const immutable = [];
      for (const object of whales[0].children) {
        const geometry = object.geometry;
        if (geometry?.type !== "BufferGeometry" || geometry === bodies[0]) continue;
        const count = geometry.getAttribute("position").count;
        const kind = count === 11 ? "tail" : count === 36 ? "mouth"
          : count === 4 ? geometry.getAttribute("position").array[0] < 0 ? "left-fin" : "right-fin" : null;
        if (!kind) throw Error("Unexpected unchanged whale geometry");
        if (!whales.every(whale => whale.children.some(child => child.geometry === geometry))) throw Error("Static whale geometry lost sharing");
        immutable.push({ kind: "static:" + kind, geometry });
      }
      if (immutable.length !== 4) throw Error("Expected tail, both fins and mouth");
      currentIds = new Set(variable.map(value => value.geometry.uuid));
      for (const { kind, geometry } of [...variable, ...immutable]) watch(geometry, kind);
      for (const { kind, geometry } of immutable) {
        if (!staticIds.has(kind)) staticIds.set(kind, geometry.uuid);
        if (staticIds.get(kind) !== geometry.uuid) throw Error("A static whale part was replaced during a quality change");
      }
      const variableRows = variable.map(({ kind, geometry, instances }) => ({ kind, uuid: geometry.uuid, instances,
        ...signature(geometry), ...(geometry.parameters ? { radial: geometry.parameters.radialSegments, tubular: geometry.parameters.tubularSegments } : {}) }));
      const fixed = immutable.map(({ kind, geometry }) => ({ kind, uuid: geometry.uuid, ...signature(geometry) })).sort((a, b) => a.kind.localeCompare(b.kind));
      const info = original.renderer.info;
      return {
        sameScene: original.canvas.isConnected && active?.renderer === original.renderer && active?.camera === original.camera && active?.scene === original.scene,
        quality: document.querySelector("#atlas .literary-globe").getAttribute("data-globe-quality-tier"),
        edition: document.querySelector("#atlas .literary-globe").getAttribute("data-globe-edition"),
        pose: { position: original.camera.position.toArray().map(value => Number(value.toFixed(5))),
          quaternion: original.camera.quaternion.toArray().map(value => Number(value.toFixed(5))), zoom: Number(original.camera.zoom.toFixed(5)) },
        variable: variableRows, fixed, bufferBytes: variableRows.reduce((sum, row) => sum + row.bytes, 0),
        drawTriangles: variableRows.reduce((sum, row) => sum + row.indices / 3 * row.instances, 0),
        disposal: { undisposedRetired: ledger().filter(row => !row.static && !row.current && row.disposals !== 1).length,
          disposedStatic: ledger().filter(row => row.static && row.disposals !== 0).length },
        rendererDiagnostic: { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
          triangles: info.render.triangles, calls: info.render.calls, frame: info.render.frame },
      };
    };
    window.__antiqueProbe = { sample, ledger, disconnect() {
      for (const record of geometries.values()) record.geometry.removeEventListener("dispose", record.listener);
      geometries.clear();
    } };
  });
}

const expected = {
  high: { bodyVertices: 735, bodyIndices: 4080, ringSegments: 256, baseSegments: 192 },
  balanced: { bodyVertices: 459, bodyIndices: 2496, ringSegments: 192, baseSegments: 144 },
  economy: { bodyVertices: 247, bodyIndices: 1296, ringSegments: 128, baseSegments: 96 },
};
const sample = page => page.evaluate(() => window.__antiqueProbe.sample());
const shapeSignature = value => value.variable.map(({ uuid: _uuid, ...shape }) => shape);
async function settled(page, tier) {
  let actual;
  await expect.poll(async () => {
    actual = await sample(page);
    const profile = expected[tier], body = actual.variable.find(row => row.kind === "body");
    return actual.quality === tier && body.vertices === profile.bodyVertices && body.indices === profile.bodyIndices
      && actual.variable.filter(row => row.kind.startsWith("ring:")).every(row => row.tubular === profile.ringSegments)
      && actual.variable.filter(row => row.kind.startsWith("base:")).every(row => row.tubular === profile.baseSegments)
      && actual.disposal.undisposedRetired === 0 && actual.disposal.disposedStatic === 0;
  }, { intervals: [40, 80, 160], timeout: 8_000 }).toBe(true);
  // Observe the committed geometry after actual browser frames, without forcing
  // an extra renderer or bypassing its demand-driven lifecycle.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return sample(page);
}
async function openSettings(page) {
  const panel = page.locator(".native-planet-panel"), settings = panel.locator("[data-planet-graphics-settings]");
  if (!await panel.isVisible()) await page.locator('[data-atlas-action="open-collection"]').click();
  await expect(panel).toBeVisible();
  if (await settings.getAttribute("open") === null) await settings.locator("summary").click();
  return settings;
}
async function closeSettings(page) {
  await page.locator(".native-planet-panel").getByRole("button", { name: "Вернуться к планете", exact: true }).click();
  await expect(page.locator(".native-planet-panel")).toBeHidden();
}
async function choose(page, tier) {
  const settings = await openSettings(page);
  await settings.locator('[data-planet-quality-option="' + tier + '"]').check();
  return settled(page, tier);
}
function retained(actual, initial, page) {
  expect(actual.sameScene).toBe(true); expect(actual.edition).toBe(ANTIQUE);
  expect(actual.pose).toEqual(initial.pose); expect(actual.fixed).toEqual(initial.fixed);
  expect(actual.disposal).toEqual({ undisposedRetired: 0, disposedStatic: 0 });
  expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
}

test("antique detail tiers reduce actual buffers and dispose superseded shared bodies through 30 quality changes without replacing the canonical scene", async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo), { page } = fixture;
  try {
    const globe = page.locator("#atlas .literary-globe");
    await expect(globe).toHaveAttribute("data-globe-edition", ANTIQUE);
    const zoomOut = page.locator('[data-globe-control="zoom-out"]');
    for (let step = 0; step < 12 && await zoomOut.isEnabled(); step++) {
      await zoomOut.click(); await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    }
    await expect(zoomOut).toBeDisabled();
    await installProbe(page);
    let previousPose, stable = 0;
    await expect.poll(async () => {
      const value = JSON.stringify((await sample(page)).pose);
      stable = value === previousPose ? stable + 1 : 0; previousPose = value; return stable;
    }, { intervals: [100, 150, 200] }).toBeGreaterThanOrEqual(3);
    const high = await settled(page, "high");
    await page.screenshot({ path: testInfo.outputPath("antique-high.png") });
    const balanced = await choose(page, "balanced"); retained(balanced, high, page);
    const economy = await choose(page, "economy"); retained(economy, high, page);
    expect(high.bufferBytes).toBeGreaterThan(balanced.bufferBytes); expect(balanced.bufferBytes).toBeGreaterThan(economy.bufferBytes);
    expect(high.drawTriangles).toBeGreaterThan(balanced.drawTriangles); expect(balanced.drawTriangles).toBeGreaterThan(economy.drawTriangles);
    await closeSettings(page);
    await page.screenshot({ path: testInfo.outputPath("antique-economy.png") });
    const warmed = await choose(page, "high"); retained(warmed, high, page);
    expect(shapeSignature(warmed)).toEqual(shapeSignature(high));
    fixture.result.observations.push({ phase: "tier-warmup", high, balanced, economy, warmed });

    const changes = [];
    for (let cycle = 0; cycle < 10; cycle++) for (const tier of ["balanced", "economy", "high"]) {
      const actual = await choose(page, tier); retained(actual, high, page);
      expect(actual.bufferBytes).toBe(({ high, balanced, economy })[tier].bufferBytes);
      expect(actual.drawTriangles).toBe(({ high, balanced, economy })[tier].drawTriangles);
      if (tier === "high") expect(shapeSignature(actual)).toEqual(shapeSignature(high));
      changes.push({ switch: changes.length + 1, cycle: cycle + 1, tier, actual });
    }
    expect(changes).toHaveLength(30);
    await closeSettings(page);
    const final = await settled(page, "high"); retained(final, high, page);
    expect(shapeSignature(final)).toEqual(shapeSignature(high));
    const ledger = await page.evaluate(() => window.__antiqueProbe.ledger());
    const retiredBodies = ledger.filter(row => row.kind === "body" && !row.current);
    expect(retiredBodies).toHaveLength(33); // Three warmup switches + thirty measured changes.
    expect(retiredBodies.every(row => row.disposals === 1)).toBe(true);
    expect(ledger.filter(row => row.static)).toHaveLength(4);
    expect(ledger.filter(row => row.static).every(row => row.disposals === 0)).toBe(true);
    expect(ledger.filter(row => !row.static && row.current)).toHaveLength(6);
    await expect(page.locator("canvas")).toHaveCount(1);
    fixture.result.observations.push({ phase: "thirty-quality-switches", changes, final,
      scopedGeometryDisposalConfirmed: true, globalGpuLeakAbsenceClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});
