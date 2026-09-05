import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, onTestFinished } from "vitest";
import { runPlatformBoundaryAudit } from "./platform-boundaries.mjs";

const dependencies = { react: "19.0.0", "@react-three/fiber": "9.0.0", three: "0.179.0", "ordinary-library": "1.0.0" };

function fixture(t, files = {}, options = {}) {
  const fixtureParent = fs.realpathSync(os.tmpdir());
  const rootDir = fs.mkdtempSync(path.join(fixtureParent, "literary-platform-boundaries-"));
  onTestFinished(() => {
    const resolved = fs.realpathSync(rootDir);
    assert.equal(path.dirname(resolved), fixtureParent);
    assert.ok(path.basename(resolved).startsWith("literary-platform-boundaries-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const input = { "package.json": JSON.stringify({ dependencies }), "src/main.tsx": 'export const ready = true;', ...files };
  for (const [name, content] of Object.entries(input)) {
    const file = path.resolve(rootDir, name);
    const relative = path.relative(rootDir, file);
    assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { rootDir, audit: () => runPlatformBoundaryAudit({ rootDir, canonicalSceneFiles: {}, canvasOwnerFiles: [], ...options }) };
}

const codes = (result) => result.findings.map((finding) => finding.code);
function rejects(result, code) {
  assert.equal(result.pass, false);
  assert.ok(codes(result).includes(code), `Expected ${code}: ${JSON.stringify(result.findings)}`);
}

test("ordinary dependencies, comments, strings and DOM canvas do not trigger native/scene rules", (t) => {
  const { audit } = fixture(t, { "src/main.tsx": 'import "ordinary-library"; const docs = "import native from @capacitor/core"; /* <Canvas /> */ export const View = () => <canvas aria-label="map" />;' });
  assert.equal(audit().pass, true);
});

test("web graph follows lazy imports, re-exports and cycles to the native leak", (t) => {
  const { audit } = fixture(t, {
    "src/main.tsx": 'void import("./entry");',
    "src/entry.ts": 'export * from "./bridge";',
    "src/bridge.ts": 'export * from "./entry"; export { Camera } from "@capacitor/camera";',
  });
  const result = audit();
  rejects(result, "NATIVE_SDK_IN_WEB_GRAPH");
  assert.equal(result.webReachableFileCount, 3);
});

test("native adapters may import native SDKs when isolated from the web entry", (t) => {
  const { audit } = fixture(t, { "src/platform/adapters/android/Store.ts": 'import { Capacitor } from "@capacitor/core"; export { Capacitor };' });
  const result = audit();
  assert.equal(result.pass, true, JSON.stringify(result.findings));
  assert.equal(result.webReachableFileCount, 1);
  assert.equal(result.auditedRuntimeFileCount, 2);
});

test("web importing a native adapter is rejected even if it has no SDK import", (t) => {
  const { audit } = fixture(t, { "src/main.tsx": 'import "./platform/adapters/ios/Store";', "src/platform/adapters/ios/Store.ts": 'export const available = false;' });
  rejects(audit(), "NATIVE_SOURCE_IN_WEB_GRAPH");
});

test("native provider paths outside exact adapter roots fail even when unreachable", (t) => {
  const { audit } = fixture(t, { "src/services/Store.ios.ts": 'export const available = true;', "src/services/RuStoreBillingProvider.ts": 'export const available = true;' });
  const result = audit();
  assert.equal(result.findings.filter((finding) => finding.code === "NATIVE_PROVIDER_OUTSIDE_ADAPTER").length, 2);
});

test("native type-only SDK import is still a source boundary violation outside adapters", (t) => {
  const { audit } = fixture(t, { "src/unused.ts": 'import type { Capacitor } from "@capacitor/core"; export type Value = typeof Capacitor;' });
  const result = audit();
  rejects(result, "NATIVE_IMPORT_OUTSIDE_ADAPTER");
  assert.ok(!codes(result).includes("NATIVE_SDK_IN_WEB_GRAPH"));
});

test("npm aliases cannot disguise native SDKs", (t) => {
  const { audit } = fixture(t, { "package.json": JSON.stringify({ dependencies: { harmless: "npm:@capacitor/core@8.5.1" } }), "src/main.tsx": 'import "harmless";' });
  rejects(audit(), "NATIVE_SDK_IN_WEB_GRAPH");
});

test("native and remote-update npm aliases remain restricted with query/hash suffixes", (t) => {
  for (const suffix of ["?client", "?url", "#module"]) {
    rejects(fixture(t, { "package.json": JSON.stringify({ dependencies: { bridge: "npm:@capacitor/core@8.5.1" } }), "src/main.tsx": `import "bridge${suffix}";` }).audit(), "NATIVE_SDK_IN_WEB_GRAPH");
    rejects(fixture(t, { "package.json": JSON.stringify({ dependencies: { updater: "npm:@capgo/capacitor-updater@7.0.0" } }), "src/platform/adapters/android/Update.ts": `import "updater${suffix}";` }).audit(), "REMOTE_RUNTIME_SDK");
  }
});

test("TypeScript paths aliases resolve local native leaks", (t) => {
  const { audit } = fixture(t, {
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@shared/*": ["src/shared/*"] } } }),
    "src/main.tsx": 'import "@shared/billing";',
    "src/shared/billing.ts": 'import "@ionic-native/core";',
  });
  rejects(audit(), "NATIVE_SDK_IN_WEB_GRAPH");
});

test("missing reachable runtime imports fail; inactive legacy and type-only imports are not bundled edges", (t) => {
  const { audit } = fixture(t, { "src/main.tsx": 'import type { Old } from "./missing-types"; export const ready = true;', "src/unused.ts": 'import "./legacy-missing-image.png";' });
  assert.equal(audit().pass, true);
  const broken = fixture(t, { "src/main.tsx": 'import "./missing-runtime";' });
  rejects(broken.audit(), "UNRESOLVED_IMPORT");
});

test("test-support files are excluded from discovery but audited if runtime reachable", (t) => {
  const contents = { "src/catalog.generated-test-support.ts": 'import fs from "node:fs"; export { fs };' };
  assert.equal(fixture(t, contents).audit().pass, true);
  rejects(fixture(t, { ...contents, "src/main.tsx": 'import "./catalog.generated-test-support";' }).audit(), "UNSUPPORTED_MODULE_LOADER");
});

test("literal import.meta.glob and query imports follow the canonical dependency", (t) => {
  const { audit } = fixture(t, {
    "src/main.tsx": 'const modules = import.meta.glob(["./parts/*.tsx", "!./parts/Unused.tsx"]); void import("./parts/Scene.tsx?build=fast");',
    "src/parts/Scene.tsx": 'import "react-native";',
    "src/parts/Unused.tsx": 'export const unused = true;',
  });
  const result = audit();
  rejects(result, "NATIVE_SDK_IN_WEB_GRAPH");
  assert.equal(result.webReachableFileCount, 2);
});

for (const [title, source, code] of [
  ["computed dynamic import", 'const name = "./other"; void import(name);', "DYNAMIC_MODULE_LOADER"],
  ["computed CommonJS require", 'const name = "react"; require(name);', "DYNAMIC_MODULE_LOADER"],
  ["computed glob", 'const pattern = "./*.ts"; import.meta.glob(pattern);', "DYNAMIC_MODULE_LOADER"],
  ["empty glob", 'import.meta.glob("./none/*.tsx");', "UNRESOLVED_GLOB"],
  ["aliased require", 'const load = require; load("@capacitor/core");', "ALIASED_MODULE_LOADER"],
  ["aliased indirect eval", 'const load = globalThis["eval"]; load("import(x)");', "ALIASED_MODULE_LOADER"],
  ["indirect eval", '(0, eval)("import(x)");', "ALIASED_MODULE_LOADER"],
  ["constructed code", 'new Function("return import(x)");', "OPAQUE_EXECUTABLE_LOADER"],
  ["global executable load", 'window.importScripts("https://example.test/run.js");', "OPAQUE_EXECUTABLE_LOADER"],
  ["remote ESM", 'import "https://example.test/runtime.js";', "REMOTE_MODULE_IMPORT"],
  ["virtual module", 'import "virtual:runtime";', "UNSUPPORTED_MODULE_LOADER"],
  ["CommonJS native import", 'const native = require("@capacitor/core");', "NATIVE_SDK_IN_WEB_GRAPH"],
  ["TypeScript import equals", 'import native = require("@capacitor/core");', "NATIVE_SDK_IN_WEB_GRAPH"],
]) test(`${title} fails closed`, (t) => rejects(fixture(t, { "src/main.tsx": source }).audit(), code));

for (const [title, source, additional = {}] of [
  ["renamed JSX", 'import { Canvas as Stage } from "@react-three/fiber"; export const Scene = () => <Stage />;'],
  ["namespace JSX", 'import * as Fiber from "@react-three/fiber"; export const Scene = () => <Fiber.Canvas />;'],
  ["re-exported JSX", 'import { Stage } from "./barrel"; export const Scene = () => <Stage />;', { "src/barrel.ts": 'export { Canvas as Stage } from "@react-three/fiber";' }],
  ["re-export namespace JSX", 'import * as Shared from "./barrel"; export const Scene = () => <Shared.Stage />;', { "src/barrel.ts": 'export { Canvas as Stage } from "@react-three/fiber";' }],
  ["aliased barrel namespace JSX", 'import * as Scene from "./barrel"; const Alias = Scene; export const App = () => <Alias.Canvas />;', { "src/barrel.ts": 'export { Canvas } from "@react-three/fiber";' }],
  ["destructured barrel namespace JSX", 'import * as Scene from "./barrel"; const { Canvas: Stage } = Scene; export const App = () => <Stage />;', { "src/barrel.ts": 'export { Canvas } from "@react-three/fiber";' }],
  ["nested namespace re-export JSX", 'import { Shared } from "./barrel"; const Alias = Shared; export const App = () => <Alias.Stage />;', { "src/barrel.ts": 'export * as Shared from "./nested";', "src/nested.ts": 'export { Canvas as Stage } from "@react-three/fiber";' }],
  ["namespace alias through default export", 'import Stage from "./barrel"; export const App = () => <Stage.Canvas />;', { "src/barrel.ts": 'import * as Scene from "./nested"; const Alias = Scene; export default Alias;', "src/nested.ts": 'export { Canvas } from "@react-three/fiber";' }],
  ["barrel export shadowed by internal namespace export", 'import { Stage } from "./barrel"; export const App = () => <Stage />;', { "src/barrel.ts": 'import { Canvas } from "@react-three/fiber"; export const Stage = Canvas; namespace Internal { export const Stage = () => null; }' }],
  ["outer alias shadowed in unrelated function", 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; function unrelated() { const Stage = () => null; return Stage; } export const App = () => <Stage />;'],
  ["outer alias shadowed in unrelated block", 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; { const Stage = () => null; } export const App = () => <Stage />;'],
  ["outer alias shadowed in TypeScript namespace", 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; namespace Helpers { export const Stage = () => null; } export const App = () => <Stage />;'],
  ["outer alias shadowed in switch scope", 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; switch (1) { case 1: const Stage = () => null; break; } export const App = () => <Stage />;'],
  ["inner Canvas alias sharing an outer ordinary name", 'import { Canvas } from "@react-three/fiber"; const Stage = () => null; export function App() { const Stage = Canvas; return <Stage />; }'],
  ["local alias JSX", 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; export const Scene = () => <Stage />;'],
  ["React default createElement", 'import React from "react"; import { Canvas } from "@react-three/fiber"; export const Scene = () => React.createElement(Canvas);'],
  ["JSX runtime factory", 'import { jsx } from "react/jsx-runtime"; import { Canvas } from "@react-three/fiber"; export const Scene = () => jsx(Canvas, {});'],
  ["awaited namespace alias", 'const { Canvas: Stage } = await import("@react-three/fiber"); export const Scene = () => <Stage />;'],
  ["npm package alias", 'import { Canvas } from "drawing"; export const Scene = () => <Canvas />;', { "package.json": JSON.stringify({ dependencies: { drawing: "npm:@react-three/fiber@9.0.0" } }) }],
]) test(`unapproved ${title} Canvas creation is rejected`, (t) => rejects(fixture(t, { "src/main.tsx": source, ...additional }).audit(), "UNAPPROVED_CANVAS_OWNER"));

test("lexical shadowing by local component or parameter does not create a false Canvas site", (t) => {
  const { audit } = fixture(t, { "src/main.tsx": 'import { Canvas } from "@react-three/fiber"; const Stage = Canvas; function Local() { const Stage = () => null; return <Stage />; } function Parameter(Canvas) { return <Canvas />; } export { Local, Parameter };' });
  assert.equal(audit().pass, true);
});

test("barrel cycle does not lose a reachable aliased Canvas export or recurse forever", (t) => {
  const { audit } = fixture(t, { "src/main.tsx": 'import * as Scene from "./barrel"; const Alias = Scene; export const App = () => <Alias.Canvas />;', "src/barrel.ts": 'export * from "./nested";', "src/nested.ts": 'export * from "./barrel"; export { Canvas } from "@react-three/fiber";' });
  rejects(audit(), "UNAPPROVED_CANVAS_OWNER");
});

test("exact canonical globe and existing bookshelf owners pass; extra site in owner fails", (t) => {
  const source = 'import { Canvas } from "@react-three/fiber"; export const Scene = () => <Canvas />;';
  const { audit, rootDir } = fixture(t, { "src/Globe.tsx": source, "src/Books.tsx": source }, { canvasOwnerFiles: ["src/Globe.tsx", "src/Books.tsx"] });
  assert.equal(audit().pass, true);
  fs.appendFileSync(path.join(rootDir, "src/Globe.tsx"), '\nconst duplicate = <Canvas />;');
  rejects(audit(), "CANVAS_OWNER_COUNT");
});

test("copied globe declaration and copied filename are rejected even outside web graph", (t) => {
  const { audit } = fixture(t, { "src/LiteraryGlobe.tsx": 'export function LiteraryGlobe() {}', "src/copied.ts": 'export const LiteraryGlobe = () => null;', "src/other/LiteraryGlobe.tsx": 'export const renamed = () => null;' }, { canonicalSceneFiles: { LiteraryGlobe: "src/LiteraryGlobe.tsx" } });
  assert.equal(audit().findings.filter((finding) => finding.code === "DUPLICATE_GLOBE_FOUNDATION").length, 2);
});

for (const [source, code] of [
  ['import { createRoot as root } from "@react-three/fiber"; root(document.createElement("canvas"));', "MANUAL_R3F_ROOT"],
  ['import * as THREE from "three"; new THREE.WebGLRenderer();', "MANUAL_RENDERER"],
  ['import { WebGPURenderer as Renderer } from "three"; new Renderer();', "MANUAL_RENDERER"],
  ['import { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js"; new WebGLRenderer();', "MANUAL_RENDERER"],
  ['import { WebGPURenderer } from "three/webgpu"; new WebGPURenderer();', "MANUAL_RENDERER"],
  ['import * as GPU from "three/webgpu"; const Alias = GPU; new Alias.WebGPURenderer();', "MANUAL_RENDERER"],
  ['import Renderer from "three/src/renderers/WebGLRenderer.js"; new Renderer();', "MANUAL_RENDERER"],
]) test(`additional renderer/root is rejected: ${code}`, (t) => rejects(fixture(t, { "src/main.tsx": source }).audit(), code));

test("static bundled Capacitor configuration permits type imports, aliases and spreads", (t) => {
  const { audit } = fixture(t, { "capacitor.config.ts": 'import type { CapacitorConfig } from "@capacitor/cli"; const bundled = { webDir: "dist", server: { allowNavigation: [] } }; const config = { ...bundled, appId: "ru.probpera.planet", appName: "Literary Planet" } satisfies CapacitorConfig; export default config;' });
  assert.equal(audit().pass, true);
});

for (const [title, source, code] of [
  ["remote URL through spread", 'const base = { server: { url: "https://probpera.ru" } }; export default { webDir: "dist", ...base };', "REMOTE_NATIVE_RUNTIME"],
  ["navigation escape", 'export default { webDir: "dist", server: { allowNavigation: ["*"] } };', "REMOTE_NATIVE_RUNTIME"],
  ["malformed navigation escape", 'export default { webDir: "dist", server: { allowNavigation: "*" } };', "REMOTE_NATIVE_RUNTIME"],
  ["remote updates", 'export default { webDir: "dist", plugins: { CapacitorUpdater: { autoUpdate: true } } };', "REMOTE_NATIVE_RUNTIME"],
  ["remote webDir", 'export default { webDir: "https://probpera.ru" };', "INVALID_BUNDLED_WEB_DIR"],
  ["parent webDir", 'export default { webDir: "../remote-build" };', "INVALID_BUNDLED_WEB_DIR"],
  ["environment expression", 'export default { webDir: "dist", server: { url: process.env.SERVER_URL } };', "NATIVE_CONFIG_NOT_STATIC"],
  ["post-declaration mutation", 'const config = { webDir: "dist" }; config.server = { url: "https://probpera.ru" }; export default config;', "NATIVE_CONFIG_NOT_STATIC"],
  ["executable initializer", 'const unused = (() => { throw new Error("MUST NOT EXECUTE"); })(); export default { webDir: "dist" };', "NATIVE_CONFIG_NOT_STATIC"],
  ["runtime import", 'import "./setup"; export default { webDir: "dist" };', "NATIVE_CONFIG_NOT_STATIC"],
  ["mutable config", 'let config = { webDir: "dist" }; export default config;', "NATIVE_CONFIG_NOT_STATIC"],
  ["inherited remote server URL", 'export default { webDir: "dist", server: { __proto__: { url: "https://example.test/runtime" } } };', "NATIVE_CONFIG_NOT_STATIC"],
  ["inherited remote server through spread", 'const base = { __proto__: { url: "https://example.test/runtime" } }; export default { webDir: "dist", server: { ...base } };', "NATIVE_CONFIG_NOT_STATIC"],
  ["quoted prototype declaration", 'export default { webDir: "dist", "__proto__": { server: { url: "https://example.test/runtime" } } };', "NATIVE_CONFIG_NOT_STATIC"],
]) test(`native config ${title} fails without executing configuration`, (t) => rejects(fixture(t, { "capacitor.config.ts": source }).audit(), code));

test("remote update SDK is forbidden even inside isolated native adapter", (t) => {
  const { audit } = fixture(t, { "src/platform/adapters/android/Update.ts": 'import "@capgo/capacitor-updater";' });
  rejects(audit(), "REMOTE_RUNTIME_SDK");
});

test("configuration review never executes an initializer with observable side effects", (t) => {
  const marker = "__v12_boundary_config_execution_probe__";
  assert.equal(Object.hasOwn(globalThis, marker), false);
  onTestFinished(() => { delete globalThis[marker]; });
  const { audit } = fixture(t, { "capacitor.config.ts": `export default (() => { globalThis[${JSON.stringify(marker)}] = true; return { webDir: "dist" }; })();` });
  rejects(audit(), "NATIVE_CONFIG_NOT_STATIC");
  assert.equal(Object.hasOwn(globalThis, marker), false);
});

test("native adapter graph rejects unresolved transitive runtime imports", (t) => {
  const { audit } = fixture(t, { "src/platform/adapters/android/Store.ts": 'import "../../../shared";', "src/shared.ts": 'import "./missing";' });
  rejects(audit(), "UNRESOLVED_IMPORT");
});

test("missing configured entry and source roots are visible failures", (t) => {
  const { audit } = fixture(t, {}, { entryPoints: ["src/missing.tsx"], sourceRoots: ["src", "missing"] });
  const result = audit();
  rejects(result, "MISSING_WEB_ENTRY");
  rejects(result, "MISSING_SOURCE_ROOT");
});

test("configured paths cannot escape the audit root", (t) => {
  const { audit } = fixture(t, {}, { adapterRoots: ["../outside"] });
  assert.throws(audit, /Audit path leaves root/u);
});
