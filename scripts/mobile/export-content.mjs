import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import {
  contentPackageCanonicalJson, prepareContentPackageManifest,
  signContentPackageManifest, verifyContentPackageSignature,
} from "./content-package-signature.mjs";
import { verifyPreviousContentExport } from "./content-export-input.mjs";

const root = await fs.realpath(fileURLToPath(new URL("../../", import.meta.url)));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => contentPackageCanonicalJson(value) + "\n";
// Internal held diagnostics can exceed the package's JSON node bound. They are
// never packaged; the canonical projector already bounds their ID inventories.
const reportJson = value => JSON.stringify(value, null, 2) + "\n";
const git = args => execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
  { cwd: root, windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();

function contained(relative) {
  const absolute = path.resolve(root, relative), local = path.relative(root, absolute);
  if (!local || local.startsWith("..") || path.isAbsolute(local)) throw new Error("Content output escapes checkout");
  return absolute;
}

async function directory(relative) {
  const target = contained(relative);
  const segments = path.relative(root, target).split(path.sep);
  let parent = root;
  for (const segment of segments) {
    parent = path.join(parent, segment);
    try { await fs.mkdir(parent); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const stat = await fs.lstat(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(parent) !== parent) throw new Error("Linked content output directory");
  }
  return target;
}

async function readContained(relative, maximum = 64 * 1024 * 1024) {
  const filename = contained(relative), stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum || await fs.realpath(filename) !== filename) throw new Error("Invalid contained content input");
  return fs.readFile(filename);
}

/** Local candidate export only. A QA key is ephemeral and is never written;
 * held text, tool bundle and internal diagnostics never enter package files. */
export async function runContentExport({ output, sourceCommit, version = 1, previous, previousManifestSha256, qaSign = false } = {}) {
  if (typeof output !== "string" || !/^\.tmp\/content-exports\/[a-z0-9][a-z0-9._-]{0,79}$/u.test(output)) throw new Error("Use a new .tmp/content-exports/<name> output");
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit) || git(["rev-parse", "HEAD"]) !== sourceCommit) throw new Error("Exact committed source checkpoint required");
  if (!Number.isSafeInteger(version) || version < 1 || typeof qaSign !== "boolean") throw new Error("Invalid content generation options");
  if (Boolean(previous) !== Boolean(previousManifestSha256) || (previousManifestSha256 && !/^[a-f0-9]{64}$/u.test(previousManifestSha256))) {
    throw new Error("A previous candidate requires its independently retained manifest SHA-256");
  }
  const sourceScopes = ["src", "data", "package.json", "package-lock.json", "tsconfig.json",
    "scripts/mobile/export-content.mjs", "scripts/mobile/content-package-signature.mjs", "scripts/mobile/content-export-input.mjs"];
  if (git(["status", "--porcelain", "--untracked-files=all", "--", ...sourceScopes])) throw new Error("Commit canonical content/tool source before export");
  const destination = contained(output);
  try { await fs.lstat(destination); throw new Error("Refuse replacing a content candidate"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const toolRelative = `.tmp/content-export-tools/${randomUUID()}`;
  const toolDirectory = await directory(toolRelative);
  const inputs = new Map();
  for (const name of ["package.json", "package-lock.json", "tsconfig.json", "scripts/mobile/export-content.mjs", "scripts/mobile/content-package-signature.mjs", "scripts/mobile/content-export-input.mjs"]) {
    inputs.set(name, sha(await readContained(name)));
  }
  const entry = [
    'import { countries, bookArchiveCountries } from "./src/data/countries/index";',
    'import { buildCanonicalContentCandidate } from "./src/planet/contentExport";',
    'export { compareContentCandidates } from "./src/planet/contentDependencies";',
    'export const project = sourceCommit => buildCanonicalContentCandidate({ countries, bookArchiveCountries, sourceCommit });',
  ].join("\n");
  const bundled = await build({ absWorkingDir: root, stdin: { contents: entry, resolveDir: root, loader: "ts", sourcefile: "content-export-tool-entry.ts" },
    bundle: true, packages: "external", platform: "node", format: "esm", target: "node22", write: false,
    outfile: path.join(toolDirectory, "projector.mjs"), logLevel: "silent", plugins: [{ name: "exact-content-source-bytes", setup(builder) {
      builder.onLoad({ filter: /\.(?:[cm]?js|ts|tsx|json)$/ }, async args => {
        const relative = path.relative(root, args.path).replaceAll("\\", "/");
        const bytes = await readContained(relative);
        const digest = sha(bytes);
        if (inputs.has(relative) && inputs.get(relative) !== digest) throw new Error("Content source changed during bundling");
        inputs.set(relative, digest);
        const extension = path.extname(args.path).slice(1);
        return { contents: bytes, resolveDir: path.dirname(args.path), loader: ["json", "ts", "tsx"].includes(extension) ? extension : "js" };
      });
    } }] });
  if (bundled.outputFiles.length !== 1) throw new Error("Unexpected content tool outputs");
  const toolFile = path.join(toolDirectory, "projector.mjs");
  await fs.writeFile(toolFile, bundled.outputFiles[0].contents, { flag: "wx" });
  const { project, compareContentCandidates } = await import(pathToFileURL(toolFile).href);
  const candidate = project(sourceCommit);
  const previousBytes = previous ? await readContained(previous) : null;
  let previousGeneration = null;
  if (previousBytes) {
    const parent = path.posix.dirname(previous.replaceAll("\\", "/"));
    const previousFiles = await Promise.all(["ru/catalog.json", "en/catalog.json", "dependency-index.json"].map(async name => ({
      path: name, bytes: await readContained(path.posix.join(parent, "package", name)),
    })));
    previousGeneration = verifyPreviousContentExport({ candidateBytes: previousBytes,
      manifestBytes: await readContained(path.posix.join(parent, "manifest.json")), files: previousFiles,
      expectedManifestSha256: previousManifestSha256 });
    if (version <= previousGeneration.version) {
      throw new Error("Content generation version must increase");
    }
  }
  const changes = compareContentCandidates(previousGeneration?.candidate ?? null, candidate, previousGeneration?.dependencies);
  const staleIds = new Set(changes.staleUnitIds);
  const packageUnits = candidate.units.filter(unit => !staleIds.has(unit.id));
  const files = ["ru", "en"].map(locale => ({ path: `${locale}/catalog.json`, bytes: json({
    schemaVersion: candidate.schemaVersion, contract: candidate.contract, sourceCommit,
    namespace: candidate.namespace, locale, units: packageUnits.filter(unit => unit.locale === locale), releaseReady: false,
  }) }));
  files.push({ path: "dependency-index.json", bytes: json(changes) });
  const packageId = "literary-planet-adult-candidate";
  const manifest = prepareContentPackageManifest({ packageId, version, sourceCommit, files });
  let envelope = null, verification = null, publicKey = null;
  if (qaSign) {
    // The private key exists only for this local run and is not a purchase or
    // release authority. Verification does not authorize client activation.
    const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const keyId = "content-qa-" + randomUUID();
    envelope = signContentPackageManifest({ manifest, keyId, privateKey: pair.privateKey });
    verification = verifyContentPackageSignature({ envelope, files,
      trustedKeys: [{ keyId, purpose: "literary-planet-content-data", environment: "local-qa", publicKey: pair.publicKey }],
      expected: { packageId, version, sourceCommit, namespace: "adult", childPolicy: null, readerVersion: 1 } });
    if (!verification.verified || verification.activationAllowed || verification.releaseReady) throw new Error("Local content signature verification failed");
    publicKey = { keyId, purpose: "literary-planet-content-data", environment: "local-qa", jwk: pair.publicKey.export({ format: "jwk" }) };
  }
  const sourceInputs = [...inputs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, sha256]) => ({ path: name, sha256 }));
  for (const input of sourceInputs) if (sha(await readContained(input.path)) !== input.sha256) throw new Error("Canonical source changed during export");
  if (git(["rev-parse", "HEAD"]) !== sourceCommit || git(["status", "--porcelain", "--untracked-files=all", "--", ...sourceScopes])) throw new Error("Source checkpoint changed during export");
  const stageDirectory = await directory(`${toolRelative}/candidate`);
  for (const file of files) {
    await directory(`${toolRelative}/candidate/package/${path.posix.dirname(file.path)}`);
    const filename = path.join(stageDirectory, "package", file.path);
    await fs.writeFile(filename, file.bytes, { flag: "wx" });
    if (sha(await fs.readFile(filename)) !== sha(file.bytes)) throw new Error("Content output write differs");
  }
  const reports = {
    "candidate.json": candidate, "manifest.json": manifest, "source-inputs.json": sourceInputs,
    ...(envelope ? { "signature.json": envelope, "qa-public-key.json": publicKey, "signature-verification.json": verification } : {}),
  };
  const heldReasons = {};
  for (const unit of candidate.held) for (const reason of unit.reasons) heldReasons[reason] = (heldReasons[reason] || 0) + 1;
  const result = { schemaVersion: 1, status: qaSign ? "LOCAL_QA_SIGNED_CANDIDATE_VERIFIED" : "UNSIGNED_CANDIDATE_PREPARED", sourceCommit,
    output, version, locales: ["ru", "en"], units: candidate.units.length, heldUnits: candidate.held.length, heldReasons,
    unitsByLocale: Object.fromEntries(["ru", "en"].map(locale => [locale, candidate.units.filter(unit => unit.locale === locale).length])),
    packageUnitsByLocale: Object.fromEntries(["ru", "en"].map(locale => [locale, packageUnits.filter(unit => unit.locale === locale).length])),
    excludedStaleUnits: staleIds.size,
    sourceInputs: sourceInputs.length, sourceInputsSha256: sha(reportJson(sourceInputs)), toolEntrySha256: sha(entry), toolBundleSha256: sha(bundled.outputFiles[0].contents),
    previous: previousBytes ? { path: previous, sha256: sha(previousBytes), manifestSha256: previousGeneration.manifestSha256 } : null,
    changedUnits: changes.changedUnitIds.length, staleUnits: changes.staleUnitIds.length, tombstones: changes.tombstones.length,
    files: manifest.files, manifestSha256: sha(reportJson(manifest)), signatureVerified: verification?.verified ?? false, privateKeyPersisted: false,
    canonicalFactsChanged: false, editorialApprovalCreated: false, activationAllowed: false, stageAccepted: false, releaseReady: false };
  reports["result.json"] = result;
  for (const [name, value] of Object.entries(reports)) await fs.writeFile(path.join(stageDirectory, name), reportJson(value), { flag: "wx" });
  await directory(".tmp/content-exports");
  if (await fs.realpath(stageDirectory) !== stageDirectory || await fs.realpath(path.dirname(destination)) !== path.dirname(destination)) throw new Error("Linked publication parent");
  // Both absolute endpoints are contained and checked before this local move.
  // The complete candidate appears only after every file/check has succeeded.
  await fs.rename(stageDirectory, destination);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let index = 0; index < args.length; index++) {
      const name = args[index];
      if (name === "--qa-sign" && options.qaSign === undefined) { options.qaSign = true; continue; }
      const key = { "--output": "output", "--source-commit": "sourceCommit", "--version": "version", "--previous": "previous", "--previous-manifest-sha256": "previousManifestSha256" }[name];
      if (!key || options[key] !== undefined || !args[index + 1]) throw new Error("Use --output --source-commit [--version] [--previous + --previous-manifest-sha256] [--qa-sign]");
      const value = args[++index]; options[key] = key === "version" ? Number(value) : value;
    }
    console.log(JSON.stringify(await runContentExport(options), null, 2));
  } catch (error) { console.error(JSON.stringify({ status: "CONTENT_EXPORT_REJECTED", message: error.message, releaseReady: false })); process.exitCode = 1; }
}
