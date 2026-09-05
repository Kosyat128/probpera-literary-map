import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { build as bundle } from "esbuild";
import { verifyPwaArtifact } from "./verify-pwa-artifact.mjs";
import { generatePwaShellFiles } from "./pwa-shell.mjs";
import { PWA_BOOTSTRAP_ENTRIES, bootstrapSourcePath, pwaAuthoritySha256 } from "./pwa-artifact.mjs";
import { normalizePwaWorkerConfig } from "../../src/pwa/serviceWorkerRuntime.js";

const roots = [];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
async function fixture({ qa = false, configured = false } = {}) {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/pwa-audit-test-"));
  roots.push(root);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const git = args => execFileSync("git", ["-c", "user.name=PWA Audit Fixture", "-c", "user.email=pwa-audit@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=.git/disabled-hooks", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(["commit", "--quiet", "--allow-empty", "-m", "Local audit fixture checkpoint"]);
  const checkpoint = git(["rev-parse", "HEAD"]);
  const authority = qa || configured ? { issuer: "fixture-authority", audience: "fixture", product: "fixture", trustedKeys: [{ kid: "fixture", jwk: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" }) }] } : null;
  const authoritySha256 = pwaAuthoritySha256(authority);
  const authoritySource = authority ? { path: qa ? ".tmp/pwa-qa/authority.json" : "configuration/public-authority.json", sha256: sha(json(authority)) } : null;
  const output = path.join(root, "dist-pwa");
  async function write(relative, bytes, base = output) {
    await mkdir(path.dirname(path.join(base, relative)), { recursive: true });
    await writeFile(path.join(base, relative), bytes);
  }
  if (authoritySource) await write(authoritySource.path, json(authority), root);
  const workerSource = "export function installPwaWorker(worker, config) { worker.addEventListener('message', () => config); }\n";
  const inputs = new Set(["src/main.tsx", "src/pwa/serviceWorkerRuntime.js", "src/pwa/qaSceneProbe.ts", "index.html", "vite.config.ts", "vite.pwa.config.ts", "tsconfig.json", "package.json", "package-lock.json", "scripts/mobile/build-pwa.mjs", "scripts/mobile/pwa-artifact.mjs", "scripts/mobile/pwa-shell.mjs", ...PWA_BOOTSTRAP_ENTRIES.map(bootstrapSourcePath)]);
  for (const filename of inputs) await write(filename, filename === "src/pwa/serviceWorkerRuntime.js" ? workerSource : filename.endsWith(".json") ? "{}\n" : "fixture input " + filename, root);
  const sourceFiles = [];
  for (const filename of [...inputs].sort()) sourceFiles.push({ path: filename, sha256: sha(await readFile(path.join(root, filename))) });
  const sourceInputs = { sha256: sha(json(sourceFiles)), files: sourceFiles };
  const generated = generatePwaShellFiles({ builtHtml: '<!doctype html><html><head><script type="module" src="/planet/assets/app.js"></script><link rel="stylesheet" href="/planet/assets/app.css"></head><body><div id="root"></div></body></html>' });
  for (const [filename, bytes] of Object.entries(generated)) await write(filename, bytes);
  await write("assets/app.js", 'export const canonicalFixture = true;\n');
  await write("assets/app.css", 'body{color:black}\n');
  const logo = await sharp({ create: { width: 48, height: 48, channels: 4, background: "#f67518" } }).png().toBuffer();
  await write("brand/probpera-logo.png", logo);
  await write("public/brand/probpera-logo.png", logo, root);
  const provenance = { schemaVersion: 1, sourceCommit: checkpoint, files: [{ output: "brand/probpera-logo.png", source: "public/brand/probpera-logo.png", sourceSha256: sha(logo), transformation: "none" }] };
  for (const size of [192, 512]) {
    await write(`icons/icon-${size}.png`, await sharp(logo).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    provenance.files.push({ output: `icons/icon-${size}.png`, source: "public/brand/probpera-logo.png", sourceSha256: sha(logo), transformation: `resize-contain-${size}-png`, purpose: "any" });
  }
  const vite = Object.fromEntries(PWA_BOOTSTRAP_ENTRIES.map(name => [name, { file: "assets/app.js", imports: [], css: ["assets/app.css"] }]));
  if (qa) {
    await write("assets/qaSceneProbe-fixture.js", 'export function installPwaSceneProbe(target){["127.0.0.1","localhost","[::1]"].includes(target.location.hostname)&&Object.defineProperty(target,"__literaryPlanetQaScenes",{value:()=>[]})}\n');
    vite["src/pwa/qaSceneProbe.ts"] = { file: "assets/qaSceneProbe-fixture.js", imports: [] };
  }
  await write(".vite/manifest.json", json(vite));
  const ownership = { schemaVersion: 1, sourceInputsSha256: sourceInputs.sha256, entries: await Promise.all(Object.keys(vite).sort().map(async source => ({ source, sourceSha256: sourceFiles.find(input => input.path === bootstrapSourcePath(source)).sha256, files: [{ file: vite[source].file, sha256: sha(await readFile(path.join(output, vite[source].file))) }] }))) };
  await write("module-ownership.json", json(ownership));
  async function list(directory, prefix = "") {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) result.push(...await list(path.join(directory, entry.name), prefix + entry.name + "/"));
      else result.push(prefix + entry.name);
    }
    return result.sort();
  }
  const files = [];
  for (const filename of (await list(output)).filter(filename => filename !== ".vite/manifest.json")) {
    const bytes = await readFile(path.join(output, filename));
    const shell = ["index.html", "ru/index.html", "en/index.html"].includes(filename);
    files.push({ url: "/planet/" + (shell ? filename.replace(/index\.html$/u, "") : filename), bytes: bytes.length, sha256: sha(bytes), kind: shell ? "shell" : "asset" });
  }
  const workerSourceSha256 = sha(workerSource);
  const buildId = sha(json({ sourceCommit: checkpoint, sourceInputsSha256: sourceInputs.sha256, workerSourceSha256, authoritySha256, localQaAuthority: qa, authoritySource, rollbackReference: null, files }));
  const config = { schemaVersion: 1, scopePath: "/planet/", buildId, entrypoints: { root: "/planet/", ru: "/planet/ru/", en: "/planet/en/" }, files };
  await write("bootstrap-integrity.json", json(config));
  async function writeWorker() {
    const worker = await bundle({ stdin: { contents: "import { installPwaWorker } from './src/pwa/serviceWorkerRuntime.js';\ninstallPwaWorker(self, " + JSON.stringify(config) + ");", resolveDir: root, sourcefile: "controlled-pwa-worker.js" }, absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true });
    await write("sw.js", worker.outputFiles[0].contents);
  }
  await writeWorker();
  await write("asset-provenance.json", json(provenance));
  await write("license-authority.json", json(authority));
  const artifact = { schemaVersion: 1, kind: "literary-planet-controlled-pwa-preparation", sourceCommit: checkpoint, sourceInputs, workerSourceSha256, authoritySha256, authoritySource, rollbackReference: null, buildId, profile: "SAFE_PAID_BILINGUAL_V1", commercialModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES", requiredLocales: ["ru", "en"], scopePath: "/planet/", localQaAuthority: qa, bootstrap: { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, releaseReady: false, productionActionsAuthorized: false, inventory: [] };
  async function refreshInventory() {
    artifact.inventory = [];
    for (const filename of (await list(output)).filter(filename => filename !== "artifact.json")) {
      const bytes = await readFile(path.join(output, filename)); artifact.inventory.push({ path: filename, bytes: bytes.length, sha256: sha(bytes) });
    }
    await write("artifact.json", json(artifact));
  }
  async function refreshIdentities() {
    artifact.sourceInputs.sha256 = sha(json(artifact.sourceInputs.files));
    artifact.buildId = config.buildId = sha(json({ sourceCommit: artifact.sourceCommit, sourceInputsSha256: artifact.sourceInputs.sha256, workerSourceSha256: artifact.workerSourceSha256, authoritySha256: artifact.authoritySha256, localQaAuthority: artifact.localQaAuthority, authoritySource: artifact.authoritySource, rollbackReference: artifact.rollbackReference, files: config.files }));
    artifact.bootstrap = { files: config.files.length, bytes: config.files.reduce((sum, file) => sum + file.bytes, 0) };
    await write("bootstrap-integrity.json", json(config));
    await writeWorker();
    await refreshInventory();
  }
  async function replaceTracked(filename, bytes) {
    await write(filename, bytes);
    const url = "/planet/" + (["index.html", "ru/index.html", "en/index.html"].includes(filename) ? filename.replace(/index\.html$/u, "") : filename);
    const record = config.files.find(file => file.url === url);
    if (record) { record.bytes = Buffer.byteLength(bytes); record.sha256 = sha(bytes); }
    if (filename.endsWith(".js")) {
      for (const entry of ownership.entries) for (const file of entry.files) if (file.file === filename) file.sha256 = sha(bytes);
      const metadata = json(ownership); await write("module-ownership.json", metadata);
      const owned = config.files.find(file => file.url === "/planet/module-ownership.json");
      if (owned) { owned.bytes = Buffer.byteLength(metadata); owned.sha256 = sha(metadata); }
    }
    await refreshIdentities();
  }
  await refreshInventory();
  const audit = options => verifyPwaArtifact({ rootDir: root, ...options });
  return { root, output, artifact, config, vite, ownership, provenance, git, audit, write, refreshInventory, refreshIdentities, replaceTracked };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("pwa-audit-test-")) throw new Error("Unsafe fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
});
const codes = result => result.findings.map(finding => finding.code);

describe("independent actual-file preparation audit", () => {
  it("accepts a complete default artifact with real PNGs and fresh source inputs", async () => {
    const env = await fixture();
    const result = await env.audit();
    expect(result.findings).toEqual([]);
    expect(result.pass).toBe(true);
    expect(result.releaseReady).toBe(false);
    expect(result.counts.sourceInputs).toBeGreaterThan(10);
  });
  it("requires explicit QA opt-in and a real loopback-guarded probe", async () => {
    const env = await fixture({ qa: true });
    expect(codes(await env.audit())).toContain("QA_NOT_ALLOWED");
    expect((await env.audit({ allowQa: true })).findings).toEqual([]);
    await env.replaceTracked("assets/qaSceneProbe-fixture.js", 'Object.defineProperty(window,"__literaryPlanetQaScenes",{value:()=>[]});');
    expect(codes(await env.audit({ allowQa: true }))).toContain("QA_LOOPBACK_GUARD");
  });
  it("accepts an explicit public authority without QA opt-in, probe or production approval", async () => {
    const env = await fixture({ configured: true });
    const result = await env.audit();
    expect(result.findings).toEqual([]);
    expect(result.identity.localQaAuthority).toBe(false);
    expect(result.releaseReady).toBe(false);
    expect(env.vite).not.toHaveProperty("src/pwa/qaSceneProbe.ts");
    expect(env.artifact.productionActionsAuthorized).toBe(false);
  });
  it("detects changed public configuration bytes even when they normalize to the same key", async () => {
    const env = await fixture({ configured: true });
    const source = env.artifact.authoritySource;
    const bytes = await readFile(path.join(env.root, source.path), "utf8");
    await env.write(source.path, bytes + " ", env.root);
    expect(codes(await env.audit())).toContain("AUTHORITY_SOURCE");
  });
  it("rejects a non-curve public point even when all public configuration hashes are recomputed", async () => {
    const env = await fixture({ configured: true });
    const authority = JSON.parse(await readFile(path.join(env.output, "license-authority.json"), "utf8"));
    authority.trustedKeys[0].jwk.x = "A".repeat(43); authority.trustedKeys[0].jwk.y = "A".repeat(43);
    const bytes = json(authority);
    await env.write("license-authority.json", bytes);
    await env.write(env.artifact.authoritySource.path, bytes, env.root);
    env.artifact.authoritySource.sha256 = sha(bytes); env.artifact.authoritySha256 = pwaAuthoritySha256(authority);
    await env.refreshIdentities();
    expect(codes(await env.audit())).toContain("AUTHORITY_SOURCE");
  });
  it("binds mode and selected authority input to build identity even if only metadata is tampered", async () => {
    const env = await fixture({ configured: true });
    env.artifact.localQaAuthority = true;
    await env.refreshInventory();
    expect(codes(await env.audit({ allowQa: true }))).toContain("BUILD_ID");
    env.artifact.localQaAuthority = false;
    env.artifact.authoritySource.sha256 = "f".repeat(64);
    await env.refreshInventory();
    expect(codes(await env.audit())).toEqual(expect.arrayContaining(["AUTHORITY_SOURCE", "BUILD_ID"]));
  });
  it("binds rollback to exact prior routes, manifest and the same authority", async () => {
    const env = await fixture();
    const manifest = normalizePwaWorkerConfig(env.config);
    const reference = { buildId: manifest.buildId, manifestSha256: sha(JSON.stringify(manifest)), routes: manifest.files.flatMap(file => [file.url, ...file.aliases]).sort() };
    env.config.rollbackReference = env.artifact.rollbackReference = reference;
    const previous = { schemaVersion: 1, authoritySha256: env.artifact.authoritySha256, localQaAuthority: env.artifact.localQaAuthority, manifest, reference };
    await env.write("rollback-manifest.json", json(previous)); await env.refreshIdentities();
    expect((await env.audit()).findings).toEqual([]);
    previous.localQaAuthority = true;
    await env.write("rollback-manifest.json", json(previous)); await env.refreshInventory();
    expect(codes(await env.audit())).toContain("ROLLBACK_IDENTITY");
    previous.localQaAuthority = false;
    previous.authoritySha256 = "f".repeat(64);
    await env.write("rollback-manifest.json", json(previous)); await env.refreshInventory();
    expect(codes(await env.audit())).toContain("ROLLBACK_IDENTITY");
  });
  it("rejects a changed public authority even when the ordinary inventory is repaired", async () => {
    const env = await fixture({ qa: true });
    const authority = JSON.parse(await readFile(path.join(env.output, "license-authority.json"), "utf8"));
    authority.trustedKeys[0].kid = "another-key";
    await env.write("license-authority.json", json(authority)); await env.refreshInventory();
    expect(codes(await env.audit({ allowQa: true }))).toContain("AUTHORITY_IDENTITY");
  });
  it("rejects actual same-size file corruption and cannot be fooled by repairing only inventory", async () => {
    const env = await fixture();
    await env.write("assets/app.js", 'export const canonicalFixture = null;\n');
    expect(codes(await env.audit())).toContain("INVENTORY_INTEGRITY");
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("BOOTSTRAP_INTEGRITY");
  });
  it("finds a module missing from essential closure even if every remaining hash is self-consistent", async () => {
    const env = await fixture();
    env.config.files = env.config.files.filter(file => file.url !== "/planet/assets/app.js");
    await env.refreshIdentities();
    expect(codes(await env.audit())).toContain("MISSING_CORE_MODULE");
  });
  it("accepts exact shared-chunk ownership when Vite has no source-key entry", async () => {
    const env = await fixture();
    const source = "src/components/BookArchiveSection.tsx";
    env.vite["_shared-archive-fixture.js"] = env.vite[source]; delete env.vite[source];
    await env.write(".vite/manifest.json", json(env.vite)); await env.refreshInventory();
    expect((await env.audit()).findings).toEqual([]);
  });
  it.each(["source", "output", "retry", "bootstrap", "source snapshot"])("rejects corrupted %s ownership even after inventory/build identity refresh", async reason => {
    const env = await fixture();
    if (reason === "source") env.ownership.entries[0].sourceSha256 = "f".repeat(64);
    if (reason === "output") env.ownership.entries[0].files[0].sha256 = "f".repeat(64);
    if (reason === "retry") env.ownership.entries = env.ownership.entries.filter(entry => !entry.source.endsWith("?stage5Load=retry"));
    if (reason === "source snapshot") env.ownership.sourceInputsSha256 = "f".repeat(64);
    await env.replaceTracked("module-ownership.json", json(env.ownership));
    if (reason === "bootstrap") { env.config.files = env.config.files.filter(file => file.url !== "/planet/module-ownership.json"); await env.refreshIdentities(); }
    expect(codes(await env.audit())).toContain("MODULE_OWNERSHIP");
  });
  it("rejects a missing module output and stale source input bytes", async () => {
    const env = await fixture();
    await rm(path.join(env.output, "assets/app.js"));
    expect(codes(await env.audit())).toContain("MISSING_FILE");
    await env.write("src/main.tsx", "changed source", env.root);
    expect(codes(await env.audit())).toContain("STALE_SOURCE");
  });
  it("rejects omitted source coverage even after recomputing source and build identities", async () => {
    const env = await fixture();
    env.artifact.sourceInputs.files = env.artifact.sourceInputs.files.filter(file => file.path !== "src/main.tsx");
    await env.refreshIdentities();
    expect(codes(await env.audit())).toContain("SOURCE_INPUT_SET");
  });
  it("checks current compiler settings as source inputs", async () => {
    const env = await fixture();
    await env.write("tsconfig.json", json({ compilerOptions: { target: "ES2017" } }), env.root);
    expect(codes(await env.audit())).toContain("STALE_SOURCE");
  });
  it("allows later evidence-only commits without weakening source freshness", async () => {
    const env = await fixture();
    env.git(["commit", "--quiet", "--allow-empty", "-m", "Later local evidence checkpoint"]);
    expect((await env.audit()).findings).toEqual([]);
  });
  it.each(["missing", "tree", "unrelated"])("rejects %s source checkpoint even with repaired build identity", async kind => {
    const env = await fixture();
    const tree = env.git(["rev-parse", "HEAD^{tree}"]);
    env.artifact.sourceCommit = kind === "missing" ? "f".repeat(40) : kind === "tree" ? tree : env.git(["commit-tree", tree, "-m", "Unrelated local fixture history"]);
    env.provenance.sourceCommit = env.artifact.sourceCommit;
    await env.write("asset-provenance.json", json(env.provenance));
    await env.refreshIdentities();
    expect(codes(await env.audit())).toContain("SOURCE_COMMIT");
  });
  it("requires source inputs and exact build/source/locale/profile identity", async () => {
    const env = await fixture();
    delete env.artifact.sourceInputs;
    env.artifact.buildId = "f".repeat(64);
    env.artifact.requiredLocales = ["ru"];
    env.artifact.profile = "OTHER";
    env.artifact.releaseReady = true;
    await env.refreshInventory();
    expect(codes(await env.audit())).toEqual(expect.arrayContaining(["SOURCE_INPUTS", "PRODUCT_IDENTITY", "PREPARATION_IDENTITY", "BUILD_ID"]));
  });
  it("rejects an altered embedded worker config even after its inventory hash is repaired", async () => {
    const env = await fixture();
    await env.write("sw.js", `function launch(){};launch(self,${JSON.stringify({ ...env.config, buildId: "f".repeat(64) })});`);
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("WORKER_CONFIGURATION");
  });
  it("rejects an unused matching worker configuration with no worker installation", async () => {
    const env = await fixture();
    await env.write("sw.js", "const neverInstalled = " + JSON.stringify(env.config) + ";");
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("WORKER_EXECUTABLE");
  });
  it("detects changed current public source even though every artifact byte is unchanged", async () => {
    const env = await fixture();
    await env.write("public/brand/probpera-logo.png", await sharp({ create: { width: 48, height: 48, channels: 4, background: "blue" } }).png().toBuffer(), env.root);
    expect(codes(await env.audit())).toContain("STALE_PUBLIC_SOURCE");
  });
  it("requires copied public asset provenance even when its record is omitted and inventory repaired", async () => {
    const env = await fixture();
    env.provenance.files = env.provenance.files.filter(record => record.output !== "brand/probpera-logo.png");
    await env.write("asset-provenance.json", json(env.provenance));
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("ASSET_PROVENANCE_COVERAGE");
  });
  it.each(['import "./missing-runtime.js";', 'export * from "./missing-runtime.js";', 'const load = () => import("./missing-runtime.js");'])("checks actual JavaScript dependencies omitted from self-reported Vite metadata: %s", async source => {
    const env = await fixture();
    await env.replaceTracked("assets/app.js", source + "\nexport const canonicalFixture=true;");
    expect(codes(await env.audit())).toContain("MISSING_SCRIPT_DEPENDENCY");
  });
  it.each(['import("https://other.test/runtime.js")', 'import("../../outside.js")', 'import(moduleName)'])("rejects an unsafe actual module dependency: %s", async source => {
    const env = await fixture();
    await env.replaceTracked("assets/app.js", "const load = () => " + source + ";");
    expect(codes(await env.audit())).toContain("UNSAFE_SCRIPT_DEPENDENCY");
  });
  it("keeps actual static imports in the core closure while permitting optional dynamic chunks", async () => {
    const env = await fixture();
    await env.write("assets/optional.js", "export const optional = true;");
    env.vite["optional"] = { file: "assets/optional.js" };
    await env.write(".vite/manifest.json", json(env.vite));
    await env.replaceTracked("assets/app.js", 'export const load = () => import("./optional.js");');
    expect((await env.audit()).findings).toEqual([]);
    await env.replaceTracked("assets/app.js", 'export {optional} from "./optional.js";');
    expect(codes(await env.audit())).toContain("MISSING_CORE_SCRIPT_DEPENDENCY");
  });
  it.each(["../package.json", "/outside", "C:/secret", "assets/%2e%2e/secret"])("rejects unsafe inventoried path %s without reading it", async (filename) => {
    const env = await fixture();
    env.artifact.inventory.push({ path: filename, bytes: 1, sha256: "a".repeat(64) });
    await env.write("artifact.json", json(env.artifact));
    expect(codes(await env.audit())).toContain("INVALID_INVENTORY");
  });
  it("rejects a linked artifact directory", async () => {
    const env = await fixture();
    await symlink(env.output, path.join(env.root, "linked-output"), "junction");
    expect(codes(await env.audit({ artifactDir: "linked-output" }))).toContain("OUTPUT_UNREADABLE");
  });
  it("permits only exact shipped attribution files without opening a general Markdown exception", async () => {
    const env = await fixture();
    for (const filename of ["assets/country-flags/ATTRIBUTION.md", "fonts/editorial/LICENSE.source-sans-3.md", "fonts/editorial/LICENSE.source-serif-4.md"]) {
      const bytes = "Canonical asset attribution\n";
      await env.write(filename, bytes); await env.write("public/" + filename, bytes, env.root);
      env.provenance.files.push({ output: filename, source: "public/" + filename, sourceSha256: sha(bytes), transformation: "none" });
    }
    await env.write("asset-provenance.json", json(env.provenance));
    await env.refreshInventory();
    expect((await env.audit()).findings).toEqual([]);
    await env.write("fonts/editorial/OWNER_PRIVATE.md", "Private owner instructions\n");
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("PRIVATE_OUTPUT");
  });
  it.each(["css", "assets", "imports", "dynamicImports"])("reports malformed %s module metadata without executing or throwing", async field => {
    const env = await fixture();
    env.vite["src/main.tsx"] = { file: "assets/app.js", [field]: { injected: "not an array" } };
    await env.write(".vite/manifest.json", json(env.vite));
    await env.refreshInventory();
    expect(codes(await env.audit())).toContain("VITE_MANIFEST");
  });
  it.each([".env", "src/private.ts", "03_MASTER_EXECUTIVE_PROMPT.txt", "requirements/manifest.json", "archive.zip"])("rejects private output %s even when inventoried", async (filename) => {
    const env = await fixture();
    await env.write(filename, "not runtime content"); await env.refreshInventory();
    expect(codes(await env.audit())).toContain("PRIVATE_OUTPUT");
  });
  it("finds unlisted output and private keys in both JSON and JavaScript", async () => {
    const env = await fixture();
    await env.write("unlisted.txt", "unexpected");
    expect(codes(await env.audit())).toContain("UNINVENTORIED_FILE");
    await env.write("private.json", json({ kty: "EC", d: "secret", x: "x", y: "y" }));
    await env.write("assets/key.js", 'export const key={kty:"EC",d:"secret",x:"x",y:"y"};');
    await env.write("private.txt", "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----");
    await env.refreshInventory();
    expect(codes(await env.audit())).toEqual(expect.arrayContaining(["PRIVATE_JWK", "PRIVATE_KEY"]));
  });
  it("does not treat a false QA flag as proof that QA code is absent", async () => {
    const env = await fixture({ qa: true });
    env.artifact.localQaAuthority = false; await env.refreshInventory();
    expect(codes(await env.audit())).toContain("QA_CODE_IN_DEFAULT");
  });
});

describe("installed identity, actual image bytes and shell resources", () => {
  it("reports malformed manifest icon metadata without invoking supplied JSON properties", async () => {
    const env = await fixture();
    const manifest = JSON.parse(await readFile(path.join(env.output, "en/manifest.webmanifest"), "utf8"));
    manifest.icons = { filter: 1 };
    await env.replaceTracked("en/manifest.webmanifest", json(manifest));
    expect(codes(await env.audit())).toEqual(expect.arrayContaining(["MANIFEST_IDENTITY", "MANIFEST_ICON"]));
  });
  it.each(["id", "scope", "start_url", "lang"])("rejects incorrect English manifest %s despite consistent hashes", async field => {
    const env = await fixture();
    const manifest = JSON.parse(await readFile(path.join(env.output, "en/manifest.webmanifest"), "utf8"));
    manifest[field] = field === "lang" ? "ru" : "/other/";
    await env.replaceTracked("en/manifest.webmanifest", json(manifest));
    expect(codes(await env.audit())).toContain("MANIFEST_IDENTITY");
  });
  it("reads actual PNG metadata rather than trusting file extension and manifest sizes", async () => {
    const env = await fixture();
    await env.replaceTracked("icons/icon-192.png", await sharp({ create: { width: 48, height: 48, channels: 4, background: "red" } }).png().toBuffer());
    expect(codes(await env.audit())).toContain("ICON_BYTES");
    await env.replaceTracked("icons/icon-512.png", Buffer.from("not a png"));
    expect(codes(await env.audit()).filter(code => code === "ICON_BYTES").length).toBeGreaterThan(1);
  });
  it.each([
    ["wrong language", html => html.replace('lang="en"', 'lang="ru"'), "SHELL_IDENTITY"],
    ["wrong canonical", html => html.replace('rel="canonical" href="https://probpera.ru/planet/en/"', 'rel="canonical" href="https://probpera.ru/planet/ru/"'), "SHELL_CANONICAL"],
    ["wrong hreflang", html => html.replace('hreflang="ru" href="https://probpera.ru/planet/ru/"', 'hreflang="ru" href="https://other.test/"'), "SHELL_HREFLANG"],
    ["missing module", html => html.replace('/planet/assets/app.js', '/planet/assets/missing.js'), "MISSING_RESOURCE"],
    ["remote module", html => html.replace('/planet/assets/app.js', 'https://other.test/runtime.js'), "UNSAFE_RESOURCE"],
    ["CSS masquerading as entry module", html => html.replace('src="/planet/assets/app.js"', 'src="/planet/assets/app.css"'), "SHELL_ENTRY_MODULE"],
    ["inline code", html => html.replace('</head>', '<script>alert(1)</script></head>'), "SHELL_SCRIPT"],
  ])("finds %s after hashes are consistently rebuilt", async (_name, mutate, code) => {
    const env = await fixture();
    await env.replaceTracked("en/index.html", mutate(await readFile(path.join(env.output, "en/index.html"), "utf8")));
    expect(codes(await env.audit())).toContain(code);
  });
});
