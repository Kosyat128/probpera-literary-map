import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyNativeArtifact } from "./verify-native-artifact.mjs";
import { CANONICAL_BOOK_SOURCE_REGISTRY } from "./pwa-artifact.mjs";
import { CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_ASSET_MODULE, CHILD_NATIVE_CATALOG } from "./native-child-package-assets.mjs";

const roots = [];
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
async function fixture({ platform = "android", ownership = true } = {}) {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/native-audit-test-")); roots.push(root);
  const output = path.join(root, "dist-native");
  const git = args => execFileSync("git", ["-c", "user.name=Native audit fixture", "-c", "user.email=native-audit@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=.git/disabled-hooks", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(["init", "--quiet"]); git(["commit", "--quiet", "--allow-empty", "-m", "Local native audit checkpoint"]);
  const sourceCommit = git(["rev-parse", "HEAD"]);
  async function write(filename, bytes, base = output) { const target = path.join(base, filename); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
  const nativePackages = { "@capacitor/core": "8.5.1", "@capacitor/cli": "8.5.1", "@capacitor/android": "8.5.1", "@capacitor/ios": "8.5.1", "@capacitor/app": "8.1.1", "@capacitor/network": "8.0.1", "@capacitor/preferences": "8.0.1", "@capacitor/browser": "8.0.4", "@capacitor/app-launcher": "8.0.1" };
  const pkg = { dependencies: Object.fromEntries(Object.entries(nativePackages).filter(([name]) => name !== "@capacitor/cli")), devDependencies: { "@capacitor/cli": "8.5.1" } };
  const lock = { packages: Object.fromEntries(Object.entries(nativePackages).map(([name, version]) => ["node_modules/" + name, { version, integrity: "sha512-" + Buffer.alloc(64, 1).toString("base64") }])) };
  const config = { appId: "ru.probpera.literaryplanet", appName: "Literary Planet", webDir: "dist-native", loggingBehavior: "debug", android: { path: "apps/mobile/android", allowMixedContent: false }, ios: { path: "apps/mobile/ios" }, server: { hostname: "localhost", androidScheme: "https", iosScheme: "capacitor" } };
  const sources = ["src/App.tsx", "src/host/mountHostApp.tsx", `src/platform/adapters/${platform}/entry.ts`, `src/platform/adapters/${platform}/${platform === "android" ? "Android" : "Ios"}PlatformAdapter.ts`, "native.html", "vite.native.config.ts", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json", "capacitor.config.json", "scripts/mobile/build-native.mjs", "scripts/mobile/native-base-assets.json", "scripts/mobile/pwa-artifact.mjs", CANONICAL_BOOK_SOURCE_REGISTRY, CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_ASSET_MODULE].sort();
  for (const file of sources) await write(file, file.endsWith(".json") ? "{}\n" : "fixture source " + file, root);
  await write("package.json", json(pkg), root); await write("package-lock.json", json(lock), root); await write("capacitor.config.json", json(config), root);
  await write(CHILD_NATIVE_PIN_SOURCE, json({ schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] }), root);
  const sourceInputs = { sha256: "", files: [] };
  async function refreshSources() {
    sourceInputs.files = await Promise.all(sources.map(async file => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })));
    sourceInputs.sha256 = sha(json(sourceInputs.files));
  }
  await refreshSources();
  const html = '<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; connect-src \'self\'; object-src \'none\'; base-uri \'none\'; frame-src \'none\'; form-action \'none\'"><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>';
  await write("index.html", html); await write("assets/app.js", 'import "./child.js"; export const canonicalFixture = true;\n');
  await write("assets/child.js", 'export const lazy = () => import("./detail.js");\n'); await write("assets/detail.js", 'export const title = "Fixture";\n');
  await write("assets/app.css", 'body { color: #333; background-image: url("../brand/logo.svg"); }\n');
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
  await write("brand/logo.svg", logo); await write("public/brand/logo.svg", logo, root);
  const vite = {
    "native.html": { file: "assets/app.js", isEntry: true, imports: ["_child.js"], css: ["assets/app.css"] },
    "_child.js": { file: "assets/child.js", dynamicImports: ["src/detail.ts"] },
    "src/detail.ts": { file: "assets/detail.js", isDynamicEntry: true },
  };
  await write(".vite/manifest.json", json(vite));
  const modules = [...sources.filter(file => file.startsWith("src/") || file === CANONICAL_BOOK_SOURCE_REGISTRY), ...["core", "app", "network", "preferences", "browser", "app-launcher"].map(name => `node_modules/@capacitor/${name}/dist/esm/index.js`), "\0vite/modulepreload-polyfill.js"].sort();
  const owned = { schemaVersion: 1, platform, chunks: [] };
  if (ownership) {
    for (const file of ["assets/app.js", "assets/child.js", "assets/detail.js"]) owned.chunks.push({ file, sha256: sha(await readFile(path.join(output, file))), modules: file === "assets/app.js" ? modules : ["\0fixture/" + file] });
    await write("module-ownership.json", json(owned));
  }
  const artifact = { schemaVersion: 1, kind: "literary-planet-bundled-native-preparation", platform, channel: "dev", sourceCommit, sourceInputs, requiredLocales: ["ru", "en"], releaseReady: false, productionActionsAuthorized: false, nativePackages, assetProvenance: [{ output: "brand/logo.svg", source: "public/brand/logo.svg", sourceSha256: sha(logo) }], inventory: [], buildId: "" };
  const pinChecksum = sha(await readFile(path.join(root, CHILD_NATIVE_PIN_SOURCE)));
  const catalogBytes = JSON.stringify({ schemaVersion: 1, kind: "literary-planet-child-native-assets-v1", platform: null, pinSourceChecksum: pinChecksum, reviewKeys: [], packages: [] }) + "\n";
  await write(CHILD_NATIVE_CATALOG, catalogBytes);
  artifact.childNativeAssets = { pinSource: { path: CHILD_NATIVE_PIN_SOURCE, sha256: pinChecksum }, outputs: [{ output: CHILD_NATIVE_CATALOG,
    source: CHILD_NATIVE_PIN_SOURCE, sourceSha256: pinChecksum, transformation: "fixed-native-pin-projection-v1", outputSha256: sha(catalogBytes) }] };
  const walk = async (directory, prefix = "") => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), prefix + entry.name + "/")); else files.push(prefix + entry.name);
    return files.sort();
  };
  async function saveIdentity() {
    artifact.buildId = sha(json({ sourceCommit: artifact.sourceCommit, sourceInputsSha256: sourceInputs.sha256, platform: artifact.platform, channel: artifact.channel, inventory: artifact.inventory }));
    await write("artifact.json", json(artifact));
  }
  async function refresh() {
    artifact.inventory = [];
    for (const file of (await walk(output)).filter(file => file !== "artifact.json")) { const bytes = await readFile(path.join(output, file)); artifact.inventory.push({ path: file, bytes: bytes.length, sha256: sha(bytes) }); }
    await saveIdentity();
  }
  async function replaceScript(filename, source) {
    await write(filename, source);
    if (ownership) { owned.chunks.find(chunk => chunk.file === filename).sha256 = sha(source); await write("module-ownership.json", json(owned)); }
    await refresh();
  }
  await refresh();
  return { root, output, artifact, config, owned, html, vite, sources, pkg, lock, git, write, refresh, saveIdentity, refreshSources, replaceScript, audit: options => verifyNativeArtifact({ rootDir: root, ...options }) };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("native-audit-test-")) throw new Error("Unsafe fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
});
const codes = result => result.findings.map(finding => finding.code);
describe("native child package artifact provenance", () => {
  it("binds the exact pin projection and refuses a forged catalog even with rewritten inventory", async () => {
    const f = await fixture();expect((await f.audit()).findings).toEqual([]);
    const catalog = JSON.parse(await readFile(path.join(f.output, CHILD_NATIVE_CATALOG)));catalog.platform = "android-google";
    const changed = JSON.stringify(catalog) + "\n";await f.write(CHILD_NATIVE_CATALOG, changed);f.artifact.childNativeAssets.outputs[0].outputSha256 = sha(changed);await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_PROVENANCE");
  });
  it("rejects missing exporter input, duplicate output or changed pin source", async () => {
    const f = await fixture(), retained = [...f.artifact.sourceInputs.files];f.artifact.sourceInputs.files = retained.filter(row => row.path !== CHILD_NATIVE_ASSET_MODULE);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files));await f.saveIdentity();expect(codes(await f.audit())).toContain("CHILD_NATIVE_PROVENANCE");
    f.artifact.sourceInputs.files = retained;f.artifact.sourceInputs.sha256 = sha(json(retained));f.artifact.childNativeAssets.outputs.push(f.artifact.childNativeAssets.outputs[0]);await f.refresh();expect(codes(await f.audit())).toContain("CHILD_NATIVE_PROVENANCE");
    f.artifact.childNativeAssets.outputs.pop();await f.write(CHILD_NATIVE_PIN_SOURCE, "{}", f.root);await f.refresh();expect(codes(await f.audit())).toContain("CHILD_NATIVE_PROVENANCE");
  });
  it("rejects unpinned child output and retains genuinely pre-exporter historical bundles", async () => {
    const f = await fixture();await f.write("child-native/packages/" + "a".repeat(64) + ".json", "{}");await f.refresh();expect(codes(await f.audit())).toContain("CHILD_NATIVE_PROVENANCE");
    await rm(path.join(f.output, "child-native"), { recursive: true });delete f.artifact.childNativeAssets;
    f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(row => ![CHILD_NATIVE_ASSET_MODULE, CHILD_NATIVE_PIN_SOURCE].includes(row.path));f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files));
    for (const chunk of f.owned.chunks) chunk.modules = chunk.modules.filter(module => module !== CHILD_NATIVE_PIN_SOURCE);
    await f.write("module-ownership.json", json(f.owned));await f.refresh();expect((await f.audit({ checkSourceFreshness: false })).findings).toEqual([]);expect(codes(await f.audit())).toContain("SOURCE_INPUT_SET");
  });
});
describe("canonical registry artifact binding", () => {
  it("accepts the exact native registry module and rejects changed or missing registry source bytes", async () => {
    const f = await fixture();
    expect((await f.audit()).findings).toEqual([]);
    await f.write(CANONICAL_BOOK_SOURCE_REGISTRY, json({ registryVersion: "changed-fixture" }), f.root);
    expect(codes(await f.audit())).toContain("STALE_SOURCE");
    await rm(path.join(f.root, CANONICAL_BOOK_SOURCE_REGISTRY));
    expect(codes(await f.audit())).toContain("SOURCE_INPUTS");
  });

  it("rejects native registry ownership without its input hash even after identities are recomputed", async () => {
    const f = await fixture();
    f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(file => file.path !== CANONICAL_BOOK_SOURCE_REGISTRY);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files));
    await f.saveIdentity();
    expect(codes(await f.audit())).toEqual(expect.arrayContaining(["SOURCE_INPUT_SET", "MODULE_OWNERSHIP"]));
    expect(codes(await f.audit({ checkSourceFreshness: false }))).toContain("MODULE_OWNERSHIP");
  });

  it("does not widen native ownership to other data files or registry query variants", async () => {
    const f = await fixture();
    const chunk = f.owned.chunks[0];
    const original = [...chunk.modules];
    for (const module of ["data/other-registry.json", CANONICAL_BOOK_SOURCE_REGISTRY + "?raw"]) {
      chunk.modules = [...original, module].sort();
      await f.write("module-ownership.json", json(f.owned));
      await f.refresh();
      expect(codes(await f.audit())).toContain("MODULE_OWNERSHIP");
    }
  });

  it("keeps pre-registry native snapshots historical only when no registry module is claimed", async () => {
    const f = await fixture();
    f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(file => file.path !== CANONICAL_BOOK_SOURCE_REGISTRY);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files));
    for (const chunk of f.owned.chunks) chunk.modules = chunk.modules.filter(module => module !== CANONICAL_BOOK_SOURCE_REGISTRY);
    await f.write("module-ownership.json", json(f.owned));
    await f.refresh();
    const historical = await f.audit({ checkSourceFreshness: false });
    expect(historical.findings).toEqual([]);
    expect(historical.sourceFreshnessChecked).toBe(false);
    expect(codes(await f.audit())).toContain("SOURCE_INPUT_SET");
  });
});

describe("actual bundled native artifact audit", () => {
  it.each(["android", "ios"])("verifies contained %s bytes while retaining preparation/provenance limitations", async platform => {
    const f = await fixture({ platform }), result = await f.audit();
    expect(result.findings).toEqual([]); expect(result.pass).toBe(true); expect(result.releaseReady).toBe(false);
    expect(result.sourceBinaryProvenance).toBe("self-reported-module-ownership-checked"); expect(result.counts.scripts).toBe(3);
  });
  it("reports absence of source-to-binary module evidence as unattested", async () => {
    const f = await fixture({ ownership: false }), result = await f.audit();
    expect(result.pass).toBe(true); expect(result.sourceBinaryProvenance).toBe("unattested");
  });
  it.each(["../dist-native", "/dist-native", "dist-native/../dist-native", "dist-native\\assets", "dist-native%2fassets"])("rejects unsafe output path %s", async artifactDir => {
    const f = await fixture(); expect(codes(await f.audit({ artifactDir }))).toContain("OUTPUT_UNREADABLE");
  });
  it("rejects linked output directories", async () => {
    const f = await fixture(); await symlink(f.output, path.join(f.root, "linked"), "junction");
    expect(codes(await f.audit({ artifactDir: "linked" }))).toContain("OUTPUT_UNREADABLE");
  });
  it("rejects linked source directories even when bytes match", async () => {
    const f = await fixture(); await mkdir(path.join(f.root, "linked-source"));
    await f.write("logo.svg", await readFile(path.join(f.output, "brand/logo.svg")), path.join(f.root, "linked-source"));
    await rm(path.join(f.root, "public/brand"), { recursive: true }); await symlink(path.join(f.root, "linked-source"), path.join(f.root, "public/brand"), "junction");
    expect(codes(await f.audit())).toContain("ASSET_PROVENANCE");
  });
  it("detects actual corruption independently of advertised inventory", async () => {
    const f = await fixture(); await f.write("assets/child.js", "export const corrupted = true;");
    expect(codes(await f.audit())).toContain("INVENTORY_INTEGRITY");
  });
  it("detects missing modules even when the inventory and ownership are rewritten", async () => {
    const f = await fixture(); await rm(path.join(f.output, "assets/detail.js"));
    f.owned.chunks = f.owned.chunks.filter(chunk => chunk.file !== "assets/detail.js"); await f.write("module-ownership.json", json(f.owned)); await f.refresh();
    const result = await f.audit(); expect(codes(result)).toContain("MISSING_MODULE"); expect(codes(result)).toContain("MISSING_RESOURCE");
  });
  it.each(["../escape.js", "artifact.json", "assets/app.js"])("rejects unsafe/self/duplicate inventory entry %s", async filename => {
    const f = await fixture(); f.artifact.inventory.push({ path: filename, bytes: 1, sha256: "a".repeat(64) }); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("INVALID_INVENTORY");
  });
  it.each(["releaseReady", "productionActionsAuthorized"])("rejects asserted %s", async flag => {
    const f = await fixture(); f.artifact[flag] = true; await f.saveIdentity(); expect(codes(await f.audit())).toContain("PREPARATION_IDENTITY");
  });
  it("rejects mismatched channel and unequal locales", async () => {
    const f = await fixture(); f.artifact.channel = "appStore"; f.artifact.requiredLocales = ["en"]; await f.saveIdentity(); expect(codes(await f.audit())).toContain("PRODUCT_IDENTITY");
  });
  it("rejects missing historical checkpoint", async () => {
    const f = await fixture(); f.artifact.sourceCommit = "a".repeat(40); await f.saveIdentity(); expect(codes(await f.audit())).toContain("SOURCE_COMMIT");
  });
  it("checks freshness by default and labels explicitly historical inspection", async () => {
    const f = await fixture(); await f.write("src/App.tsx", "changed canonical app", f.root);
    expect(codes(await f.audit())).toContain("STALE_SOURCE");
    const historical = await f.audit({ checkSourceFreshness: false }); expect(historical.pass).toBe(true); expect(historical.sourceFreshnessChecked).toBe(false);
  });
  it("cannot disable current public asset provenance with the historical option", async () => {
    const f = await fixture(); await f.write("public/brand/logo.svg", "changed logo", f.root);
    expect(codes(await f.audit({ checkSourceFreshness: false }))).toContain("ASSET_PROVENANCE");
  });
  it("detects omitted source and digest tampering", async () => {
    const f = await fixture(); f.artifact.sourceInputs.files.pop(); await f.saveIdentity();
    const result = await f.audit(); expect(codes(result)).toContain("SOURCE_INPUT_DIGEST"); expect(codes(result)).toContain("SOURCE_INPUT_SET");
  });
  it.each([
    config => { config.server.url = "https://example.invalid/runtime"; },
    config => { config.server.allowNavigation = ["*"]; },
    config => { config.plugins = { CapacitorUpdater: { autoUpdate: true } }; },
    config => { config.android.allowMixedContent = true; },
    config => { config.webDir = "https://example.invalid"; },
  ])("rejects remote/unsafe runtime configuration even with a refreshed source snapshot", async mutate => {
    const f = await fixture(); mutate(f.config); await f.write("capacitor.config.json", json(f.config), f.root); await f.refreshSources(); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("NATIVE_CONFIG");
  });
  it("rejects duplicated or prototype-bearing config keys", async () => {
    const f = await fixture(); await f.write("capacitor.config.json", json(f.config).replace('"hostname": "localhost"', '"hostname": "localhost", "__proto__": {"url":"https://example.invalid"}'), f.root);
    expect(codes(await f.audit())).toContain("NATIVE_CONFIG");
  });
  it("rejects unpinned native dependency despite a refreshed source snapshot", async () => {
    const f = await fixture(); f.pkg.dependencies["@capacitor/core"] = "^8.5.1"; await f.write("package.json", json(f.pkg), f.root); await f.refreshSources(); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("NATIVE_PACKAGES");
  });
  it.each(["sw.js", "license-authority.json", "nested/service-worker.js"])("rejects foreign runtime file %s with consistent metadata", async file => {
    const f = await fixture(); await f.write(file, file.endsWith("json") ? "null" : "void 0;"); await f.refresh(); expect(codes(await f.audit())).toContain("WRONG_RUNTIME_OUTPUT");
  });
  it.each(["assets/payload.JSON", "assets/payload.webmanifest", "assets/payload.txt", "assets/payload.dat"])("uses canonical private-dossier checks on %s", async file => {
    const f = await fixture(); await f.write(file, json({ schemaVersion: 2, bookKey: "canonical:work", blocks: [] })); await f.refresh(); expect(codes(await f.audit())).toContain("PRIVATE_DOSSIER_OUTPUT");
  });
  it("rejects duplicate keys hiding a private dossier", async () => {
    const f = await fixture(); await f.write("assets/renamed.dat", '{"schemaVersion":2,"bookKey":"work","blocks":[],"schemaVersion":1}'); await f.refresh(); expect(codes(await f.audit())).toContain("INVALID_JSON");
  });
  it.each(["src/private.ts", ".env", "requirements/03_MASTER.txt", "assets/source.js.map", "fonts/editorial/OTHER-LICENSE.md"])("rejects private output %s", async file => {
    const f = await fixture(); await f.write(file, "private material"); await f.refresh(); expect(codes(await f.audit())).toContain("PRIVATE_OUTPUT");
  });
  it("rejects private signing material embedded in JS and JSON", async () => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", 'export const key = { kty:"EC", crv:"P-256", d:"private" };');
    expect(codes(await f.audit())).toContain("PRIVATE_JWK");
    await f.write("assets/key.txt", "-----BEGIN PRIVATE KEY-----\nsecret"); await f.refresh(); expect(codes(await f.audit())).toContain("PRIVATE_KEY");
  });
  it.each(['import "./missing-runtime.js";', 'export { x } from "./missing-runtime.js";', 'const x = () => import("./missing-runtime.js");'])("checks actual JS imports beyond self-reported manifest %s", async source => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", source); expect(codes(await f.audit())).toContain("MISSING_RESOURCE");
  });
  it.each(['import "https://example.invalid/runtime.js";', 'import "@capacitor/core";', 'const x = path => import(path);', 'import "./app.css";'])("rejects unbundled executable dependency %s", async source => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", source); const result = await f.audit(); expect(result.pass).toBe(false); expect(codes(result).some(code => ["UNSAFE_RESOURCE", "UNSAFE_SCRIPT_DEPENDENCY"].includes(code))).toBe(true);
  });
  it("permits inert content URLs while rejecting remote shell execution", async () => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", 'export const sourceEvidence = "https://example.invalid/biography";'); expect((await f.audit()).pass).toBe(true);
    await f.write("index.html", f.html.replace('/assets/app.js', 'https://example.invalid/app.js')); await f.refresh(); expect(codes(await f.audit())).toContain("UNSAFE_RESOURCE");
  });
  it("rejects CSS in the actual module script element", async () => {
    const f = await fixture(); await f.write("index.html", f.html.replace('src="/assets/app.js"', 'src="/assets/app.css"')); await f.refresh(); expect(codes(await f.audit())).toContain("SHELL_ENTRY");
  });
  it("rejects permissive native CSP", async () => {
    const f = await fixture(); await f.write("index.html", f.html.replace("script-src 'self'", "script-src * 'unsafe-inline'")); await f.refresh(); expect(codes(await f.audit())).toContain("SHELL_CSP");
  });
  it("rejects CSP executable overrides despite a self-only script-src", async () => {
    const f = await fixture(); await f.write("index.html", f.html.replace("script-src 'self'", "script-src 'self'; script-src-elem https:")); await f.refresh(); expect(codes(await f.audit())).toContain("SHELL_CSP");
  });
  it("checks quoted CSS imports as well as url resources", async () => {
    const f = await fixture(); await f.write("assets/app.css", '@import "https://example.invalid/style.css";'); await f.refresh(); expect(codes(await f.audit())).toContain("UNSAFE_RESOURCE");
  });
  it("detects service worker registration in emitted JavaScript", async () => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", 'navigator.serviceWorker.register("/sw.js");'); expect(codes(await f.audit())).toContain("SERVICE_WORKER_RUNTIME");
  });
  it("rejects QA probe symbols even in otherwise inert content", async () => {
    const f = await fixture(); await f.replaceScript("assets/detail.js", 'export const diagnostic = "__literaryPlanetQaScenes";'); expect(codes(await f.audit())).toContain("QA_PROBE");
  });
  it("rejects claimed ownership before a late Vite byte mutation", async () => {
    const f = await fixture(); await f.write("assets/app.js", 'import "./child.js"; export const preload = ["changed-final-map"];'); await f.refresh(); expect(codes(await f.audit())).toContain("MODULE_OWNERSHIP");
  });
  it.each(["src/main.tsx", "src/platform/adapters/ios/entry.ts", "../foreign/entry.ts", "C:/foreign/entry.ts"])("rejects foreign/Web/opposite-platform ownership %s", async module => {
    const f = await fixture(); f.owned.chunks[0].modules.push(module); f.owned.chunks[0].modules.sort(); await f.write("module-ownership.json", json(f.owned)); await f.refresh(); expect(codes(await f.audit())).toContain("MODULE_OWNERSHIP");
  });
  it("rejects omitted selected native entry and SDK module evidence", async () => {
    const f = await fixture(); f.owned.chunks[0].modules = f.owned.chunks[0].modules.filter(module => !module.includes("/entry.ts") && !module.includes("@capacitor/app/")); await f.write("module-ownership.json", json(f.owned)); await f.refresh(); expect(codes(await f.audit())).toContain("MODULE_OWNERSHIP");
  });
  it("rejects a build identity copied from another inventory", async () => {
    const f = await fixture(); f.artifact.buildId = "b".repeat(64); await f.write("artifact.json", json(f.artifact)); expect(codes(await f.audit())).toContain("BUILD_ID");
  });
});
