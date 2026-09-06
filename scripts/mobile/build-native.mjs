import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "vite";
import { containedFile, artifactPath } from "./pwa-artifact.mjs";

const root = await fs.realpath(fileURLToPath(new URL("../../", import.meta.url)));
const platform = process.argv[2];
const channel = process.argv[3];
if (!({ android: ["dev", "googlePlay", "ruStore"], ios: ["dev", "appStore"] })[platform]?.includes(channel)) {
  throw new Error("Usage: node scripts/mobile/build-native.mjs android|ios dev|googlePlay|ruStore|appStore");
}
const kind = "literary-planet-bundled-native-preparation";
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
async function inputs() {
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--",
    "src", "native.html", "vite.native.config.ts", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json", "capacitor.config.json",
    "scripts/mobile/build-native.mjs", "scripts/mobile/native-base-assets.json", "scripts/mobile/pwa-artifact.mjs",
  ], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).split("\0");
  const files = [];
  for (const relative of [...new Set(paths)].filter(p => p && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(p)).sort()) {
    files.push({ path: relative, sha256: (await containedFile(root, relative)).sha256 });
  }
  return { sha256: sha(json(files)), files };
}
const sourceInputs = await inputs();
const config = JSON.parse((await containedFile(root, "capacitor.config.json")).bytes);
if (config.webDir !== "dist-native" || config.server?.url || config.server?.allowNavigation) throw new Error("Native runtime must use the local audited bundle.");
const assetSelection = JSON.parse((await containedFile(root, "scripts/mobile/native-base-assets.json")).bytes);
const scratch = path.join(root, ".tmp");
await fs.mkdir(scratch, { recursive: true });
if (await fs.realpath(scratch) !== scratch) throw new Error("Refuse linked scratch directory.");
const staging = path.join(scratch, "native-build-" + randomUUID());
await fs.mkdir(staging);
process.env.LITERARY_PLANET_NATIVE_PLATFORM = platform;
process.env.LITERARY_PLANET_NATIVE_CHANNEL = channel;
const chunks = [];
await build({
  root, configFile: path.join(root, "vite.native.config.ts"), build: { outDir: staging, emptyOutDir: false },
  plugins: [{
    name: "literary-planet-native-module-provenance",
    writeBundle(_options, bundle) {
      for (const item of Object.values(bundle)) if (item.type === "chunk") {
        const normalizedRoot = root.replaceAll("\\", "/") + "/";
        const modules = Object.keys(item.modules).map(p => {
          const normalized = p.replaceAll("\\", "/");
          return normalized.startsWith(normalizedRoot) ? normalized.slice(normalizedRoot.length) : normalized;
        }).sort();
        if (modules.some(p => ["src/main.tsx", "src/pwa/PwaEdition.tsx", "src/pwa/serviceWorkerRuntime.js"].includes(p))) throw new Error("Native graph contains a Web/PWA entry.");
        chunks.push({ file: item.fileName, sha256: sha(item.code), modules });
      }
    },
  }],
});
for (const chunk of chunks) {
  if ((await containedFile(staging, chunk.file)).sha256 !== chunk.sha256) throw new Error("Native chunk changed after writeBundle: " + chunk.file);
}
await fs.rename(path.join(staging, "native.html"), path.join(staging, "index.html"));
await fs.writeFile(path.join(staging, "module-ownership.json"), json({ schemaVersion: 1, platform, chunks: chunks.sort((a, b) => a.file.localeCompare(b.file)) }));
const assetProvenance = [];
for (const entry of assetSelection.files) {
  const relative = artifactPath(entry.output);
  if (entry.source !== "public/" + relative || entry.transformation !== "none") throw new Error("Unrecognized canonical asset selection.");
  const source = await containedFile(root, entry.source);
  if (source.sha256 !== entry.sourceSha256) throw new Error("Stale canonical asset selection: " + entry.source);
  const target = path.join(staging, relative);
  try { await fs.lstat(target); throw new Error("Asset output collision: " + relative); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, source.bytes);
  assetProvenance.push({ output: relative, source: entry.source, sourceSha256: source.sha256 });
}
async function inventory(dir, prefix = "") {
  const records = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = artifactPath(prefix + entry.name);
    if (entry.isSymbolicLink()) throw new Error("Linked artifact output.");
    if (entry.isDirectory()) records.push(...await inventory(path.join(dir, entry.name), relative + "/"));
    else if (entry.isFile()) {
      const file = await containedFile(staging, relative);
      records.push({ path: relative, bytes: file.size, sha256: file.sha256 });
    } else throw new Error("Non-file artifact output.");
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
const files = await inventory(staging);
const nativePackages = {};
const packageJson = JSON.parse((await containedFile(root, "package.json")).bytes);
for (const [name, version] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
  if (!name.startsWith("@capacitor/")) continue;
  const installed = JSON.parse((await containedFile(root, "node_modules/" + name + "/package.json")).bytes);
  if (installed.version !== version) throw new Error("Unpinned or mismatched native package: " + name);
  nativePackages[name] = version;
}
if ((await inputs()).sha256 !== sourceInputs.sha256) throw new Error("Source changed during native build.");
const buildId = sha(json({ sourceCommit, sourceInputsSha256: sourceInputs.sha256, platform, channel, inventory: files }));
const artifact = {
  schemaVersion: 1, kind, platform, channel, buildId, sourceCommit, sourceInputs,
  requiredLocales: ["ru", "en"], nativePackages, assetProvenance, inventory: files,
  releaseReady: false, productionActionsAuthorized: false,
  limits: ["Bundled implementation snapshot, not native binary/device, store, editorial, rights or owner acceptance.", "No purchase authority is implemented by this shell; release and paid channel readiness remain separate gates."],
};
await fs.writeFile(path.join(staging, "artifact.json"), json(artifact));
const output = path.join(root, "dist-native");
const previous = path.join(scratch, "native-previous-" + randomUUID());
for (const target of [staging, output, previous]) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe native output path.");
}
let moved = false;
try {
  const stat = await fs.lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(output) !== output) throw new Error("Refuse linked output.");
  const previousArtifact = JSON.parse(await fs.readFile(path.join(output, "artifact.json"), "utf8"));
  if (previousArtifact.kind !== kind) throw new Error("Refuse replacing unrecognized native output.");
  await fs.rename(output, previous); moved = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  try { await fs.lstat(output); throw new Error("Refuse output without identity."); }
  catch (check) { if (check.code !== "ENOENT") throw check; }
}
try { await fs.rename(staging, output); }
catch (error) { if (moved) await fs.rename(previous, output); throw error; }
console.log(json({ output, previous: moved ? previous : null, buildId, platform, channel, files: files.length, releaseReady: false }));
