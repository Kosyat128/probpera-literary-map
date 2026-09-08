import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, readdir, lstat, realpath, rename } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build as viteBuild } from "vite";
import { build as bundle } from "esbuild";
import sharp from "sharp";
import { artifactPath, bootstrapClosure, createPwaModuleOwnershipPlugin, containedFile, PWA_SCOPE, PWA_BOOTSTRAP_ENTRIES, scopeCanonicalCssUrls, loadPwaAuthority, pwaAuthoritySha256, previousPwaGeneration } from "./pwa-artifact.mjs";
import { generatePwaShellFiles } from "./pwa-shell.mjs";
import { GLOBE_EDITIONS, DEFAULT_GLOBE_EDITION_ID } from "../../src/components/globeEditions.ts";

// Use the canonical selectable registry, including both localized texture paths.
// A saved edition must remain loadable after an offline restart or locale change.
export function pwaGlobeTextureClosure(editions = GLOBE_EDITIONS) {
  const textures = new Map();
  for (const edition of editions.filter(item => item.visitorAvailable && item.status === "available")) {
    const version = edition.textureContentVersion;
    if (version !== null && !/^[A-Za-z0-9._-]{1,96}$/u.test(version ?? "")) throw new Error("Invalid canonical texture version: " + edition.id);
    for (const texture of [edition.desktopTexture, edition.mobileTexture]) {
      const paths = typeof texture === "string" ? [texture] : [texture?.ru, texture?.en];
      for (const candidate of paths) {
        const relative = artifactPath(candidate);
        if (!relative.startsWith("textures/")) throw new Error("Invalid canonical texture location: " + relative);
        const aliases = textures.get(relative) ?? new Set();
        if (version) aliases.add(PWA_SCOPE + relative + "?v=" + version);
        if (aliases.size > 4) throw new Error("Too many canonical aliases for " + relative);
        textures.set(relative, aliases);
      }
    }
  }
  return new Map([...textures].sort(([a], [b]) => a.localeCompare(b)));
}

// Keep importing the manifest selection helper free of build/output side effects.
async function buildPwa() {
const root = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const artifactKind = "literary-planet-controlled-pwa-preparation";
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
async function captureSourceInputs() {
  const names = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--",
    "src", "index.html", "tsconfig.json", "vite.config.ts", "vite.pwa.config.ts", "package.json", "package-lock.json",
    "scripts/mobile/build-pwa.mjs", "scripts/mobile/pwa-artifact.mjs", "scripts/mobile/pwa-shell.mjs",
  ], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).split("\0");
  const files = [];
  for (const relative of [...new Set(names)].filter(value => value && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(value)).sort()) {
    const file = await containedFile(root, relative);
    files.push({ path: relative, sha256: file.sha256 });
  }
  return { sha256: digest(json(files)), files };
}
const sourceInputs = await captureSourceInputs();
const scratch = path.join(root, ".tmp");
await mkdir(scratch, { recursive: true });
if (await realpath(scratch) !== scratch) throw new Error("PWA scratch must be a real directory in this checkout");
const staging = path.join(scratch, "pwa-build-" + randomUUID());
await mkdir(staging);
const essential = new Set();
const provenance = [];
const { authority, localQaAuthority, authoritySource } = await loadPwaAuthority(root, process.argv.slice(2));
const authoritySha256 = pwaAuthoritySha256(authority);
let rollbackGeneration = null;
try { rollbackGeneration = await previousPwaGeneration(path.join(root, "dist-pwa"), authoritySha256, localQaAuthority); }
catch (error) { if (error.code !== "ENOENT") console.warn("Previous PWA cannot be used as a verified rollback target: " + error.message); }
const rollbackReference = rollbackGeneration?.reference ?? null;
async function write(relative, bytes) {
  artifactPath(relative);
  const filename = path.join(staging, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, bytes);
}
async function walk(directory, prefix = "") {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error("Symlink inside artifact: " + relative);
    if (item.isDirectory()) result.push(...await walk(path.join(directory, item.name), relative + "/"));
    else if (item.isFile()) result.push(artifactPath(relative));
    else throw new Error("Non-file inside artifact: " + relative);
  }
  return result.sort();
}
async function copyPublic(relative, core = true) {
  if (provenance.some(item => item.output === relative)) {
    if (core) essential.add(relative);
    return;
  }
  const input = await containedFile(path.join(root, "public"), relative);
  await write(relative, input.bytes);
  provenance.push({ output: relative, source: "public/" + relative, sourceSha256: input.sha256, transformation: "none" });
  if (core) essential.add(relative);
}

const bootstrapEntries = [...PWA_BOOTSTRAP_ENTRIES, ...(localQaAuthority ? ["src/pwa/qaSceneProbe.ts"] : [])];
let moduleOwnership;
await viteBuild({
  root,
  configFile: path.join(root, "vite.pwa.config.ts"),
  plugins: [createPwaModuleOwnershipPlugin(root, sourceInputs, bootstrapEntries, ownership => { moduleOwnership = ownership; })],
  define: {
    __LITERARY_PLANET_LICENSE_AUTHORITY__: JSON.stringify(authority),
    __LITERARY_PLANET_LOCAL_QA__: JSON.stringify(localQaAuthority),
  },
  build: { outDir: staging, emptyOutDir: false },
});
const manifest = JSON.parse(await readFile(path.join(staging, ".vite/manifest.json"), "utf8"));
if (!moduleOwnership) throw new Error("Rollup did not emit bootstrap ownership");
bootstrapClosure(manifest, bootstrapEntries, moduleOwnership).forEach(file => essential.add(file));
for (const entry of moduleOwnership.entries) for (const file of entry.files) {
  if ((await containedFile(staging, file.file)).sha256 !== file.sha256) throw new Error("Owned module changed after finalized Rollup write: " + file.file);
}
await write("module-ownership.json", json(moduleOwnership));
essential.add("module-ownership.json");
for (const relative of await walk(staging)) {
  if (!relative.endsWith(".css")) continue;
  const css = await readFile(path.join(staging, relative), "utf8");
  const scoped = scopeCanonicalCssUrls(css);
  if (scoped.css !== css) throw new Error("Unscoped public CSS URL after Vite hashing: " + relative);
  for (const asset of scoped.assets) {
    if (asset.startsWith("assets/")) {
      await containedFile(staging, asset);
      if (essential.has(relative)) essential.add(asset);
    } else await copyPublic(asset, essential.has(relative) && !asset.includes("bookshelf"));
  }
}
for (const asset of [
  "brand/probpera-logo.png", "brand/magazine-hero-wide.webp", "brand/magazine-hero-wide.avif",
  "brand/magazine-hero-mobile.webp", "brand/magazine-hero-mobile.avif",
  "brand/atlas-side-brushes.webp", "brand/atlas-side-brushes-mobile.webp",
  "brand/alfred-nobel-medallion.png", "articles/book-mentions.json",
]) await copyPublic(asset);
// Canonical entry/search/reading assets already verified in the native base
// selection. Keep the same originals available for the PWA's offline surface.
// This copies existing artwork and provenance; it creates no rights approval.
for (const asset of [
  "assets/writer-portraits/q320935.webp", "assets/writer-portraits/q991.webp",
  "assets/writer-portraits/q189950.webp", "assets/writer-portraits/q318473.webp",
  "assets/writer-portraits/q31628.webp", "assets/writer-portraits/q52224.webp",
  "assets/writer-portraits/q37217.webp", "assets/writer-portraits/q7243.webp",
  "brand/book-covers/crime-and-punishment-editorial.webp",
  "brand/book-covers/thumbs/crime-and-punishment-editorial.webp",
  "brand/book-covers/the-catcher-in-the-rye-editorial.webp",
  "brand/book-covers/thumbs/the-catcher-in-the-rye-editorial.webp",
  "brand/book-covers/nineteen-eighty-four-editorial.webp",
  "brand/book-covers/thumbs/nineteen-eighty-four-editorial.webp",
  "brand/book-covers/tale-of-two-cities-editorial.webp",
  "brand/book-covers/thumbs/tale-of-two-cities-editorial.webp",
  "brand/book-covers/ann-veronica-20260820-editorial.webp",
  "brand/book-covers/thumbs/ann-veronica-20260820-editorial.webp",
  "brand/book-covers/brave-new-world-editorial.webp",
  "brand/book-covers/thumbs/brave-new-world-editorial.webp",
]) await copyPublic(asset);
for (const asset of await walk(path.join(root, "public/fonts/editorial"))) {
  await copyPublic("fonts/editorial/" + asset, asset.endsWith(".woff2"));
}
for (const asset of await walk(path.join(root, "public/assets/country-flags"))) {
  await copyPublic("assets/country-flags/" + asset, asset.endsWith(".svg"));
}
const edition = GLOBE_EDITIONS.find(item => item.id === DEFAULT_GLOBE_EDITION_ID);
if (!edition || typeof edition.desktopTexture !== "string" || typeof edition.mobileTexture !== "string") {
  throw new Error("Canonical default edition must provide exact texture paths");
}
// These included editions were already copied into the artifact. Include their
// exact paths and version aliases in the verified offline package as well.
const aliases = pwaGlobeTextureClosure();
for (const asset of aliases.keys()) await copyPublic(asset);
const appSource = (await containedFile(root, "src/App.tsx")).bytes.toString("utf8");
for (const match of appSource.matchAll(/["'](brand\/[^"'?\s]+)(?:\?v=[A-Za-z0-9._-]+)?["']/gu)) {
  await copyPublic(artifactPath(match[1]), false);
}
for (const match of appSource.matchAll(/assetUrl\(\s*"([^"?]+)\?v=([A-Za-z0-9._-]{1,96})"\s*\)/gu)) {
  const relative = artifactPath(match[1]);
  if (!essential.has(relative)) continue;
  const values = aliases.get(relative) ?? new Set();
  values.add(PWA_SCOPE + relative + "?v=" + match[2]);
  aliases.set(relative, values);
}
const logo = await containedFile(path.join(root, "public"), "brand/probpera-logo.png");
for (const size of [192, 512]) {
  const output = "icons/icon-" + size + ".png";
  const bytes = await sharp(logo.bytes).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await write(output, bytes);
  essential.add(output);
  provenance.push({ output, source: "public/brand/probpera-logo.png", sourceSha256: logo.sha256, transformation: "resize-contain-" + size + "-png", purpose: "any" });
}
const shells = generatePwaShellFiles({ builtHtml: await readFile(path.join(staging, "index.html"), "utf8") });
for (const [relative, content] of Object.entries(shells)) {
  await write(relative, content);
  essential.add(relative);
}
const entrypoints = { root: PWA_SCOPE, ru: PWA_SCOPE + "ru/", en: PWA_SCOPE + "en/" };
const shellUrl = { "index.html": entrypoints.root, "ru/index.html": entrypoints.ru, "en/index.html": entrypoints.en };
const files = [];
for (const relative of [...essential].sort()) {
  const asset = await containedFile(staging, relative);
  const url = shellUrl[relative] ?? PWA_SCOPE + relative;
  const record = { url, bytes: asset.size, sha256: asset.sha256, kind: Object.hasOwn(shellUrl, relative) ? "shell" : "asset" };
  const assetAliases = new Set(aliases.get(relative) ?? []);
  if (assetAliases.size > 4) throw new Error("Too many canonical aliases for " + relative);
  if (assetAliases.size) record.aliases = [...assetAliases].sort();
  files.push(record);
}
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
if (files.length > 512 || totalBytes > 64 * 1024 * 1024 || files.some(file => file.bytes > 16 * 1024 * 1024)) {
  throw new Error("Controlled bootstrap exceeds worker resource bounds");
}
const workerSource = await containedFile(root, "src/pwa/serviceWorkerRuntime.js");
const buildId = digest(json({ sourceCommit, sourceInputsSha256: sourceInputs.sha256, workerSourceSha256: workerSource.sha256, authoritySha256, localQaAuthority, authoritySource, rollbackReference, files }));
const configuration = { schemaVersion: 1, scopePath: PWA_SCOPE, buildId, entrypoints, files, ...(rollbackReference ? { rollbackReference } : {}) };
const worker = await bundle({
  stdin: {
    contents: "import { installPwaWorker } from './src/pwa/serviceWorkerRuntime.js';\ninstallPwaWorker(self, " + JSON.stringify(configuration) + ");",
    resolveDir: root, sourcefile: "controlled-pwa-worker.js",
  },
  bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true,
});
await write("sw.js", worker.outputFiles[0].contents);
await write("bootstrap-integrity.json", json(configuration));
await write("license-authority.json", json(authority));
if (rollbackGeneration) await write("rollback-manifest.json", json(rollbackGeneration));
await write("asset-provenance.json", json({ schemaVersion: 1, sourceCommit, files: provenance.sort((a, b) => a.output.localeCompare(b.output)) }));
await write("_headers", [
  "/planet/*",
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'",
  "  Referrer-Policy: no-referrer",
  "  X-Content-Type-Options: nosniff",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Cache-Control: no-cache",
  "/planet/assets/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "/planet/sw.js",
  "  Service-Worker-Allowed: /planet/",
  "  Cache-Control: no-cache",
  "",
].join("\n"));
const inventory = [];
for (const relative of await walk(staging)) {
  const file = await containedFile(staging, relative);
  inventory.push({ path: relative, bytes: file.size, sha256: file.sha256 });
}
await write("artifact.json", json({
  schemaVersion: 1, kind: artifactKind, sourceCommit, sourceInputs, workerSourceSha256: workerSource.sha256, authoritySha256, authoritySource, rollbackReference, buildId,
  profile: "SAFE_PAID_BILINGUAL_V1",
  commercialModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES",
  requiredLocales: ["ru", "en"], scopePath: PWA_SCOPE,
  localQaAuthority,
  bootstrap: { files: files.length, bytes: totalBytes },
  releaseReady: false, productionActionsAuthorized: false,
  pending: ["merchant-and-identity-integration", "editorial-and-legal-review", "exact-RC-and-release-gates"],
  inventory,
}));
if ((await captureSourceInputs()).sha256 !== sourceInputs.sha256) throw new Error("Source changed while the controlled artifact was being built");
if (JSON.stringify((await loadPwaAuthority(root, process.argv.slice(2))).authoritySource) !== JSON.stringify(authoritySource)) throw new Error("Public authority source changed during build");
for (const item of provenance) {
  const input = await containedFile(root, item.source);
  if (input.sha256 !== item.sourceSha256) throw new Error("Canonical public source changed during build: " + item.source);
}

// Local artifact replacement only. Preserve the previous output and recover it
// if the final rename fails; never recursively delete a computed directory.
const output = path.join(root, "dist-pwa");
const previous = path.join(scratch, "pwa-previous-" + randomUUID());
for (const target of [staging, output, previous]) {
  const relative = path.relative(root, target);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Unsafe PWA output location");
}
let movedPrevious = false;
try {
  const stat = await lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(output) !== output) throw new Error("Refuse linked PWA output");
  const existing = JSON.parse(await readFile(path.join(output, "artifact.json"), "utf8"));
  if (existing.kind !== artifactKind) throw new Error("Refuse replacing unrecognized output");
  await rename(output, previous);
  movedPrevious = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  // ENOENT for artifact.json inside an existing directory is not an empty target.
  try { await lstat(output); throw new Error("Refuse replacing output without an artifact identity"); }
  catch (check) { if (check.code !== "ENOENT") throw check; }
}
try { await rename(staging, output); }
catch (error) { if (movedPrevious) await rename(previous, output); throw error; }
console.log(json({ output, previous: movedPrevious ? previous : null, buildId, essentialFiles: files.length, essentialBytes: totalBytes, releaseReady: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPwa();
