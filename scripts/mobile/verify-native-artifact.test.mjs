import { CHILD_NATIVE_SCENE_PIN_SOURCE,CHILD_NATIVE_SCENE_ASSET_MODULE,CHILD_NATIVE_SCENE_CATALOG } from "./native-child-scene-assets.mjs";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyNativeArtifact } from "./verify-native-artifact.mjs";
import { CANONICAL_BOOK_SOURCE_REGISTRY } from "./pwa-artifact.mjs";
import { CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_ASSET_MODULE, CHILD_NATIVE_CATALOG } from "./native-child-package-assets.mjs";
import { CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_MEDIA_ASSET_MODULE, CHILD_NATIVE_MEDIA_CATALOG } from "./native-child-media-assets.mjs";
import { CHILD_NATIVE_RESOURCE_PIN_SOURCE, CHILD_NATIVE_RESOURCE_ASSET_MODULE, CHILD_NATIVE_RESOURCE_CATALOG } from "./native-child-resource-assets.mjs";

const roots = [];
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
async function fixture({ platform = "android", channel = "dev", ownership = true } = {}) {
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
  const sources = ["src/App.tsx", "src/host/mountHostApp.tsx", `src/platform/adapters/${platform}/entry.ts`, `src/platform/adapters/${platform}/${platform === "android" ? "Android" : "Ios"}PlatformAdapter.ts`, "native.html", "vite.native.config.ts", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json", "capacitor.config.json", "scripts/mobile/build-native.mjs", "scripts/mobile/native-base-assets.json", "scripts/mobile/pwa-artifact.mjs", CANONICAL_BOOK_SOURCE_REGISTRY, CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_ASSET_MODULE, CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_MEDIA_ASSET_MODULE, CHILD_NATIVE_RESOURCE_PIN_SOURCE, CHILD_NATIVE_RESOURCE_ASSET_MODULE, CHILD_NATIVE_SCENE_PIN_SOURCE, CHILD_NATIVE_SCENE_ASSET_MODULE,
    "src/child/childNativeResource.ts", "src/child/childPackage.ts", "src/child/childAccessPolicy.ts", "src/child/childDataNamespace.ts", "src/child/childProfile.ts","src/child/childNativeScene.ts","src/child/childNativeCanonicalResources.ts","src/child/childNativeMedia.ts","src/components/GlobeChildNativeComposition.tsx","src/child/childCommon3d.ts","src/child/childCommon3dImport.ts","src/child/childSceneEngine.ts","src/child/childSceneEncodedCache.ts","src/components/childSceneTransition.ts"].sort();
  for (const file of sources) await write(file, file.endsWith(".json") ? "{}\n" : "fixture source " + file, root);
  for (const source of [CHILD_NATIVE_RESOURCE_ASSET_MODULE, "src/child/childNativeResource.ts", "src/child/childPackage.ts",
    "src/child/childAccessPolicy.ts", "src/child/childDataNamespace.ts", "src/child/childProfile.ts"])
    await write(source, await readFile(new URL("../../" + source, import.meta.url)), root);
  for (const source of [CHILD_NATIVE_SCENE_ASSET_MODULE,CHILD_NATIVE_MEDIA_ASSET_MODULE,"src/child/childNativeScene.ts",
    "src/child/childNativeCanonicalResources.ts","src/child/childNativeMedia.ts","src/components/GlobeChildNativeComposition.tsx","src/child/childCommon3d.ts","src/child/childCommon3dImport.ts","src/child/childSceneEngine.ts","src/child/childSceneEncodedCache.ts","src/components/childSceneTransition.ts"])
    await write(source,await readFile(new URL("../../"+source,import.meta.url)),root);
  await write(CHILD_NATIVE_SCENE_PIN_SOURCE,json({schemaVersion:2,kind:"literary-planet-child-native-scene-release-pins-v2",reviewKeys:[],manifests:[]}),root);
  await write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json({ schemaVersion: 2, kind: "literary-planet-child-native-resource-release-pins-v2", origins: [], resources: [] }), root);
  await write("package.json", json(pkg), root); await write("package-lock.json", json(lock), root); await write("capacitor.config.json", json(config), root);
  await write(CHILD_NATIVE_PIN_SOURCE, json({ schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] }), root);
  await write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ schemaVersion: 2, kind: "literary-planet-child-native-media-release-pins-v2", reviewKeys: [], manifests: [] }), root);
  const sourceInputs = { sha256: "", files: [] };
  async function refreshSources() {
    sourceInputs.files = await Promise.all(sources.map(async file => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })));
    sourceInputs.sha256 = sha(json(sourceInputs.files));
  }
  await refreshSources();
  const html = '<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; connect-src \'self\'; img-src \'self\' data: blob: planet-child-resource:; object-src \'none\'; base-uri \'none\'; frame-src \'none\'; form-action \'none\'"><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>';
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
  const artifact = { schemaVersion: 1, kind: "literary-planet-bundled-native-preparation", platform, channel, sourceCommit, sourceInputs, requiredLocales: ["ru", "en"], releaseReady: false, productionActionsAuthorized: false, nativePackages, assetProvenance: [{ output: "brand/logo.svg", source: "public/brand/logo.svg", sourceSha256: sha(logo) }], inventory: [], buildId: "" };
  const pinChecksum = sha(await readFile(path.join(root, CHILD_NATIVE_PIN_SOURCE)));
  const catalogBytes = JSON.stringify({ schemaVersion: 1, kind: "literary-planet-child-native-assets-v1", platform: null, pinSourceChecksum: pinChecksum, reviewKeys: [], packages: [] }) + "\n";
  await write(CHILD_NATIVE_CATALOG, catalogBytes);
  artifact.childNativeAssets = { pinSource: { path: CHILD_NATIVE_PIN_SOURCE, sha256: pinChecksum }, outputs: [{ output: CHILD_NATIVE_CATALOG,
    source: CHILD_NATIVE_PIN_SOURCE, sourceSha256: pinChecksum, transformation: "fixed-native-pin-projection-v1", outputSha256: sha(catalogBytes) }] };
  const mediaPinChecksum = sha(await readFile(path.join(root, CHILD_NATIVE_MEDIA_PIN_SOURCE)));
  const mediaCatalog = JSON.stringify({ schemaVersion: 2, kind: "literary-planet-child-native-media-catalog-v2", platform: null,
    mediaPinSourceChecksum: mediaPinChecksum, reviewKeys: [], manifests: [] }) + "\n";
  await write(CHILD_NATIVE_MEDIA_CATALOG, mediaCatalog);
  artifact.childNativeMediaAssets = { pinSource: { path: CHILD_NATIVE_MEDIA_PIN_SOURCE, sha256: mediaPinChecksum },
    outputs: [{ output: CHILD_NATIVE_MEDIA_CATALOG, source: CHILD_NATIVE_MEDIA_PIN_SOURCE, sourceSha256: mediaPinChecksum,
      transformation: "fixed-native-media-pin-projection-v2", outputSha256: sha(mediaCatalog) }] };
  const resourcePinChecksum = sha(await readFile(path.join(root, CHILD_NATIVE_RESOURCE_PIN_SOURCE)));
  const selectedPlatform = platform === "ios" && channel === "appStore" ? "ios-ipados"
    : platform === "android" && channel === "googlePlay" ? "android-google"
      : platform === "android" && channel === "ruStore" ? "android-rustore" : null;
  const resourceCatalog = JSON.stringify({ schemaVersion: 2, kind: "literary-planet-child-native-resource-catalog-v2", platform: selectedPlatform,
    resourcePinSourceChecksum: resourcePinChecksum, origins: [], resources: [] }) + "\n";
  await write(CHILD_NATIVE_RESOURCE_CATALOG, resourceCatalog);
  artifact.childNativeResourceAssets = { pinSource: { path: CHILD_NATIVE_RESOURCE_PIN_SOURCE, sha256: resourcePinChecksum },
    outputs: [{ output: CHILD_NATIVE_RESOURCE_CATALOG, source: CHILD_NATIVE_RESOURCE_PIN_SOURCE, sourceSha256: resourcePinChecksum,
      transformation: "fixed-native-resource-pin-projection-v2", outputSha256: sha(resourceCatalog) }] };
  const walk = async (directory, prefix = "") => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), prefix + entry.name + "/")); else files.push(prefix + entry.name);
    return files.sort();
  };
  async function saveIdentity() {
    artifact.buildId = sha(json({ sourceCommit: artifact.sourceCommit, sourceInputsSha256: sourceInputs.sha256, platform: artifact.platform, channel: artifact.channel, inventory: artifact.inventory }));
    await write("artifact.json", json(artifact));
  }
  const scenePinChecksum=sha(await readFile(path.join(root,CHILD_NATIVE_SCENE_PIN_SOURCE)));
  const sceneCatalog=JSON.stringify({schemaVersion:2,kind:"literary-planet-child-native-scene-catalog-v2",platform:selectedPlatform,
    scenePinSourceChecksum:scenePinChecksum,reviewKeys:[],manifests:[]})+"\n";
  await write(CHILD_NATIVE_SCENE_CATALOG,sceneCatalog);
  artifact.childNativeSceneAssets={pinSource:{path:CHILD_NATIVE_SCENE_PIN_SOURCE,sha256:scenePinChecksum},outputs:[{output:CHILD_NATIVE_SCENE_CATALOG,
    source:CHILD_NATIVE_SCENE_PIN_SOURCE,sourceSha256:scenePinChecksum,transformation:"fixed-native-scene-pin-projection-v2",outputSha256:sha(sceneCatalog)}]};
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
    await rm(path.join(f.output, "child-native"), { recursive: true });delete f.artifact.childNativeAssets;delete f.artifact.childNativeMediaAssets;delete f.artifact.childNativeResourceAssets;delete f.artifact.childNativeSceneAssets;
    f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(row => ![CHILD_NATIVE_ASSET_MODULE, CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_MEDIA_ASSET_MODULE, CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_RESOURCE_ASSET_MODULE, CHILD_NATIVE_RESOURCE_PIN_SOURCE, CHILD_NATIVE_SCENE_ASSET_MODULE, CHILD_NATIVE_SCENE_PIN_SOURCE].includes(row.path));f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files));
    for (const chunk of f.owned.chunks) chunk.modules = chunk.modules.filter(module => ![CHILD_NATIVE_PIN_SOURCE, CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_RESOURCE_PIN_SOURCE,CHILD_NATIVE_SCENE_PIN_SOURCE].includes(module));
    await f.write("module-ownership.json", json(f.owned));await f.refresh();expect((await f.audit({ checkSourceFreshness: false })).findings).toEqual([]);expect(codes(await f.audit())).toContain("SOURCE_INPUT_SET");
  });
});

describe("native child resource artifact provenance", () => {
  const origin = { id: "fixture-origin", origin: "https://resources.example.org", tlsPublicKeyX963Checksums: ["a".repeat(64)] };
  const binding = { id: "fixture-resource", packageId: "fixture-package", packageVersion: 1,
    packageChecksum: "b".repeat(64), policyVersion: "fixture-policy", policyChecksum: "c".repeat(64),
    manifestChecksum: "d".repeat(64), reviewChecksum: "e".repeat(64), assetId: "fixture-image",
    assetChecksum: "f".repeat(64), assetBytes: 8, mime: "image/png", originId: origin.id,
    path: "/objects/" + "f".repeat(64) + ".png", validFromEpochMs: 0, validUntilEpochMs: 8_640_000_000_000_000 };
  async function replaceCatalog(f, change) {
    const catalog = JSON.parse(await readFile(path.join(f.output, CHILD_NATIVE_RESOURCE_CATALOG)));
    change(catalog); const bytes = JSON.stringify(catalog) + "\n";
    await f.write(CHILD_NATIVE_RESOURCE_CATALOG, bytes);
    f.artifact.childNativeResourceAssets.outputs[0].outputSha256 = sha(bytes); await f.refresh();
  }
  it("reconstructs the authentic empty resource source projection without remote approval", async () => {
    const f = await fixture(); expect((await f.audit()).findings).toEqual([]);
    const catalog = JSON.parse(await readFile(path.join(f.output, CHILD_NATIVE_RESOURCE_CATALOG)));
    expect(catalog.origins).toEqual([]); expect(catalog.resources).toEqual([]);
    expect(f.artifact.childNativeResourceAssets.outputs).toHaveLength(1);
    expect(catalog.resourcePinSourceChecksum).toBe(f.artifact.childNativeResourceAssets.pinSource.sha256);
  });
  it("rejects substituted catalog origins even after output inventory and build digests are rewritten", async () => {
    const f = await fixture(); await replaceCatalog(f, catalog => { catalog.origins = [origin]; });
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("rejects another audience platform and substituted resource source checksum", async () => {
    for (const change of [catalog => { catalog.platform = "android-google"; },
      catalog => { catalog.resourcePinSourceChecksum = "a".repeat(64); }]) {
      const f = await fixture(); await replaceCatalog(f, change);
      expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
    }
  });
  it("requires exact resource metadata whenever its compiler input or output is present", async () => {
    const f = await fixture(); delete f.artifact.childNativeResourceAssets; await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("requires the resource emitter source independently of the general freshness option", async () => {
    const f = await fixture(); f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(row => row.path !== CHILD_NATIVE_RESOURCE_ASSET_MODULE);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files)); await f.saveIdentity();
    expect(codes(await f.audit({ checkSourceFreshness: false }))).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("binds the actual schema checksum even when historical freshness checks are disabled", async () => {
    const f = await fixture();
    f.artifact.sourceInputs.files.find(row => row.path === "src/child/childNativeResource.ts").sha256 = "a".repeat(64);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files)); await f.saveIdentity();
    expect(codes(await f.audit({ checkSourceFreshness: false }))).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("binds transitive resource schema validators while historical freshness is disabled", async () => {
    for (const name of ["childPackage", "childAccessPolicy", "childDataNamespace", "childProfile"]) {
      const f = await fixture();
      f.artifact.sourceInputs.files.find(row => row.path === "src/child/" + name + ".ts").sha256 = "a".repeat(64);
      f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files)); await f.saveIdentity();
      expect(codes(await f.audit({ checkSourceFreshness: false }))).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
    }
  });
  it("rejects malformed current resource pins with an otherwise refreshed source snapshot", async () => {
    const f = await fixture(); await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, "{}", f.root);
    await f.refreshSources(); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("refuses duplicate generated output claims and missing resource catalog bytes", async () => {
    const f = await fixture(); f.artifact.childNativeResourceAssets.outputs.push(f.artifact.childNativeResourceAssets.outputs[0]); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
    f.artifact.childNativeResourceAssets.outputs.pop(); await rm(path.join(f.output, CHILD_NATIVE_RESOURCE_CATALOG)); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("denies orphan resource files despite a self-consistent artifact inventory", async () => {
    const f = await fixture(); await f.write("child-native/resources/unowned.json", "{}"); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("denies orphan origin bindings in actual source pins rather than treating a TLS hash as approval", async () => {
    const f = await fixture({ channel: "googlePlay" });
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json({ schemaVersion: 2, kind: "literary-planet-child-native-resource-release-pins-v2",
      origins: [origin], resources: [] }), f.root); await f.refreshSources(); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("requires independently signed media and real binary closure for every optional transport binding", async () => {
    const f = await fixture({ channel: "googlePlay" });
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json({ schemaVersion: 2, kind: "literary-planet-child-native-resource-release-pins-v2",
      origins: [origin], resources: [binding] }), f.root); await f.refreshSources();
    const sourceChecksum = sha(await readFile(path.join(f.root, CHILD_NATIVE_RESOURCE_PIN_SOURCE)));
    f.artifact.childNativeResourceAssets.pinSource.sha256 = sourceChecksum;
    f.artifact.childNativeResourceAssets.outputs[0].sourceSha256 = sourceChecksum;
    await replaceCatalog(f, catalog => { catalog.platform = "android-google"; catalog.resourcePinSourceChecksum = sourceChecksum;
      catalog.origins = [origin]; catalog.resources = [binding]; });
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
  });
  it("rejects an invented projection transformation instead of trusting an artifact output checksum", async () => {
    const f = await fixture(); f.artifact.childNativeResourceAssets.outputs[0].transformation = "caller-resource-proof";
    await f.refresh(); expect(codes(await f.audit())).toContain("CHILD_NATIVE_RESOURCE_PROVENANCE");
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

describe("native child media artifact provenance", () => {
  it("reconstructs the exact empty independent media projection from current source pins", async () => {
    const f = await fixture(); expect((await f.audit()).findings).toEqual([]);
    expect(f.artifact.childNativeMediaAssets.outputs).toHaveLength(1);
  });
  it("denies forged media approval even after inventory and build identity are rewritten", async () => {
    const f = await fixture(), catalog = JSON.parse(await readFile(path.join(f.output, CHILD_NATIVE_MEDIA_CATALOG)));
    catalog.reviewKeys = [{ keyId: "child-media-review-forged", reviewerId: "caller", publicKeyX963Hex: "04" + "1".repeat(128) }];
    const bytes = JSON.stringify(catalog) + "\n"; await f.write(CHILD_NATIVE_MEDIA_CATALOG, bytes);
    f.artifact.childNativeMediaAssets.outputs[0].outputSha256 = sha(bytes); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
  });
  it("requires the actual media emitter input and exact independent pin source", async () => {
    const f = await fixture(); f.artifact.sourceInputs.files = f.artifact.sourceInputs.files.filter(row => row.path !== CHILD_NATIVE_MEDIA_ASSET_MODULE);
    f.artifact.sourceInputs.sha256 = sha(json(f.artifact.sourceInputs.files)); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
  });
  it("denies extra binaries and paths despite self-consistent artifact digests", async () => {
    const f = await fixture(); await f.write("child-native/media/assets/" + "b".repeat(64) + ".png", Buffer.from("unreviewed"));
    await f.refresh(); expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
  });
  it("denies duplicated output claims and missing media catalog bytes", async () => {
    const f = await fixture(); f.artifact.childNativeMediaAssets.outputs.push(f.artifact.childNativeMediaAssets.outputs[0]); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
    f.artifact.childNativeMediaAssets.outputs.pop(); await rm(path.join(f.output, CHILD_NATIVE_MEDIA_CATALOG)); await f.refresh();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
  });
  it("keeps text pins independent when the media source itself becomes malformed", async () => {
    const f = await fixture(), original = await readFile(path.join(f.root, CHILD_NATIVE_PIN_SOURCE));
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, "{}", f.root); await f.refreshSources(); await f.saveIdentity();
    expect(codes(await f.audit())).toContain("CHILD_NATIVE_MEDIA_PROVENANCE");
    expect(await readFile(path.join(f.root, CHILD_NATIVE_PIN_SOURCE))).toEqual(original);
  });
});

describe("native original canonical scene artifact provenance",()=>{
 it("reconstructs authentic empty scene pins as one exact catalog and grants no approved scene",async()=>{
  const f=await fixture();expect((await f.audit()).findings).toEqual([]);
  const catalog=JSON.parse(await readFile(path.join(f.output,CHILD_NATIVE_SCENE_CATALOG)));
  expect(catalog.manifests).toEqual([]);expect(catalog.reviewKeys).toEqual([]);
  expect(f.artifact.childNativeSceneAssets.outputs).toHaveLength(1);
 });
 it("rejects substituted scene metadata despite recomputed output/build inventory",async()=>{
  const f=await fixture(),catalog=JSON.parse(await readFile(path.join(f.output,CHILD_NATIVE_SCENE_CATALOG)));
  catalog.manifests=[{sceneId:"invented",approved:true}];const bytes=JSON.stringify(catalog)+"\n";
  await f.write(CHILD_NATIVE_SCENE_CATALOG,bytes);f.artifact.childNativeSceneAssets.outputs[0].outputSha256=sha(bytes);await f.refresh();
  expect(codes(await f.audit())).toContain("CHILD_NATIVE_SCENE_PROVENANCE");
 });
 it("rejects an orphan native scene output and unbound generated shell image policy",async()=>{
  const f=await fixture();await f.write("child-native/scenes/orphan.json","{}");await f.refresh();
  expect(codes(await f.audit())).toContain("CHILD_NATIVE_SCENE_PROVENANCE");
  await rm(path.join(f.output,"child-native/scenes/orphan.json"));await f.write("index.html",f.html.replace(" planet-child-resource:",""));await f.refresh();
  expect(codes(await f.audit())).toContain("SHELL_CSP");
 });
 it("pins imported engine, cache and transition semantics even with historical comparison disabled",async()=>{
  const f=await fixture();
  for(const source of ["src/child/childCommon3d.ts","src/child/childCommon3dImport.ts","src/child/childSceneEngine.ts","src/child/childSceneEncodedCache.ts","src/components/childSceneTransition.ts"]){
   const original=await readFile(path.join(f.root,source));await f.write(source,"substituted engine source",f.root);
   expect(codes(await f.audit({checkSourceFreshness:false}))).toContain("CHILD_NATIVE_SCENE_PROVENANCE");await f.write(source,original,f.root);
  }
  expect((await f.audit({checkSourceFreshness:false})).findings).toEqual([]);
 });
 it("uses current scene compiler even when the general historical comparison is disabled",async()=>{
  const f=await fixture();await f.write("src/child/childNativeScene.ts","substituted schema",f.root);
  expect(codes(await f.audit({checkSourceFreshness:false}))).toContain("CHILD_NATIVE_SCENE_PROVENANCE");
 });
});
