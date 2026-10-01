import path from "node:path";
import { lstat, realpath, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";
import { build } from "esbuild";
import { artifactPath } from "./pwa-artifact.mjs";

export const STAGING_SOURCE_ROOTS = Object.freeze(["src", "server", "scripts", "supabase/migrations", "tests", "package.json", "package-lock.json", "index.html", "vite.config.ts", "vite.pwa.config.ts", "tsconfig.json", "vitest.config.ts", "data/book-canon-source-registry.json"]);
export const LOCAL_SMOKE_SUITES = Object.freeze(["scripts/mobile/pwa-staging-package.test.mjs", "server/planet/api.test.ts", "server/planet/worker.test.ts", "server/planet/integration.test.ts"]);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const reject = code => { const error = new Error(code); error.code = code; throw error; };
const exact = (value, keys) => object(value) && same(Object.keys(value).sort(), [...keys].sort());
const git = (root, args) => execFileSync("git", ["--no-optional-locks", "-c", "safe.directory=" + root, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });

async function existing(root, relative, directory = false, limit = 64 * 1024 * 1024) {
  artifactPath(relative);
  let filename = root;
  for (const component of relative.split("/")) {
    filename = path.join(filename, component);
    if ((await lstat(filename)).isSymbolicLink() || await realpath(filename) !== filename) reject("LINKED_INPUT");
  }
  const stat = await lstat(filename);
  if (directory ? !stat.isDirectory() : !stat.isFile() || stat.size > limit) reject("INVALID_INPUT");
  if (directory) return filename;
  return readFile(filename);
}
async function referenced(roots, ref, limit = 16 * 1024 * 1024) {
  if (!exact(ref, ["path", "sha256"]) || !hash(ref.sha256)) reject("INVALID_REFERENCE");
  const filename = path.resolve(roots[0], ref.path);
  const base = roots.find(root => { const relative = path.relative(root, filename); return relative && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative); });
  if (!base) reject("REFERENCE_ESCAPE");
  const relative = path.relative(base, filename).split(path.sep).join("/");
  if (/(?:^|\/)\.env(?:\.|$)/u.test(relative)) reject("PRIVATE_REFERENCE");
  const bytes = await existing(base, relative, false, limit);
  if (sha(bytes) !== ref.sha256) reject("REFERENCE_DRIFT");
  return bytes;
}
export async function stagingSourceSnapshot(rootDir, runGit = git) {
  const root = await realpath(rootDir);
  const names = runGit(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...STAGING_SOURCE_ROOTS]).split("\0").filter(Boolean).sort();
  if (!names.length || new Set(names).size !== names.length || names.some(name => /(?:^|\/)\.env(?:\.|$)/u.test(name))) reject("INVALID_SOURCE_SET");
  const files = [];
  for (const name of names) files.push({ path: artifactPath(name), sha256: sha(await existing(root, name)) });
  return { schemaVersion: 1, sourceCommit: runGit(root, ["rev-parse", "HEAD"]).trim(), files };
}
async function candidateFiles(root, relative, artifact) {
  const directory = await existing(root, relative, true);
  if (!Array.isArray(artifact.inventory) || artifact.inventory.length > 4096) reject("INVALID_INVENTORY");
  const bytesByPath = new Map();
  let total = 0;
  for (const entry of artifact.inventory) {
    if (!exact(entry, ["path", "bytes", "sha256"]) || !hash(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.path === "artifact.json" || bytesByPath.has(entry.path)) reject("INVALID_INVENTORY");
    const bytes = await existing(directory, entry.path);
    total += bytes.length;
    if (total > 512 * 1024 * 1024 || bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) reject("CANDIDATE_DRIFT");
    bytesByPath.set(entry.path, bytes);
  }
  const names = [];
  async function walk(relativeDir = "") {
    for (const entry of await readdir(path.join(directory, relativeDir), { withFileTypes: true })) {
      const relativeName = relativeDir ? relativeDir + "/" + entry.name : entry.name;
      if (entry.isSymbolicLink()) reject("LINKED_INPUT");
      if (entry.isDirectory()) await walk(relativeName);
      else if (entry.isFile()) names.push(relativeName);
      else reject("INVALID_INPUT");
    }
  }
  await walk();
  if (!same(names.filter(name => name !== "artifact.json").sort(), [...bytesByPath.keys()].sort())) reject("UNINVENTORIED_FILE");
  return bytesByPath;
}
function draftConfig(bytes) {
  const parsed = ts.parseConfigFileTextToJson("wrangler.draft.jsonc", bytes.toString("utf8"));
  const c = parsed.config;
  if (parsed.error || !exact(c, ["$schema", "name", "main", "compatibility_date", "compatibility_flags", "workers_dev", "preview_urls", "vars", "assets", "observability"])
    || c.main !== "worker.ts" || c.name !== "literary-planet-v12-preparation" || c.workers_dev !== false || c.preview_urls !== false
    || !exact(c.vars, []) || !same(c.compatibility_flags, ["nodejs_compat"]) || !/^\d{4}-\d{2}-\d{2}$/u.test(c.compatibility_date)
    || !exact(c.observability, ["enabled"]) || c.observability.enabled !== false
    || !exact(c.assets, ["directory", "binding", "run_worker_first", "html_handling", "not_found_handling"])
    || c.assets.directory !== "../../dist-pwa" || c.assets.binding !== "ASSETS" || c.assets.run_worker_first !== true
    || c.assets.html_handling !== "none" || c.assets.not_found_handling !== "none") reject("UNSAFE_DRAFT_CONFIG");
  return { name: c.name, main: "worker.mjs", compatibility_date: c.compatibility_date, compatibility_flags: c.compatibility_flags,
    workers_dev: false, preview_urls: false, vars: {}, assets: { directory: "./pwa", binding: "ASSETS", run_worker_first: true, html_handling: "none", not_found_handling: "none" }, observability: { enabled: false } };
}

/** All validation is local. Supplied frozen reports certify only their stated scopes. */
export async function preparePwaStaging(options, dependencies = {}) {
  const root = await realpath(options.rootDir ?? process.cwd());
  const validationRoot = await realpath(options.validationRoot);
  if (!(await lstat(validationRoot)).isDirectory()) reject("INVALID_VALIDATION_ROOT");
  const roots = [root, validationRoot];
  const readRef = (ref, limit) => referenced(roots, ref, limit);
  const runGit = dependencies.git ?? git;
  const bundle = dependencies.bundle ?? build;
  if (!/^[a-f0-9]{40}$/u.test(options.expectedHead ?? "") || !hash(options.expectedBuildId) || typeof options.writePackage !== "boolean" || typeof options.allowQa !== "boolean") reject("INVALID_OPTIONS");
  const dir = artifactPath(options.artifactDir), out = artifactPath(options.outputDir);
  if (!/^(?:\.tmp|artifacts)\//u.test(out) || dir === out || dir.startsWith(out + "/") || out.startsWith(dir + "/")) reject("INVALID_OUTPUT");
  await existing(root, path.posix.dirname(out), true);
  try { await lstat(path.join(root, out)); reject("OUTPUT_EXISTS"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  // An unignored output would dirty the checkout through this command's own writes.
  try { runGit(root, ["check-ignore", "--quiet", "--no-index", "--", out]); } catch { reject("UNIGNORED_OUTPUT"); }
  if (runGit(root, ["rev-parse", "HEAD"]).trim() !== options.expectedHead || runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]).trim()) reject("SOURCE_NOT_CLEAN");
  const receiptBytes = await readRef(options.validationReceipt);
  const receipt = JSON.parse(receiptBytes);
  if (!exact(receipt, ["schemaVersion", "kind", "sourceCommit", "artifact", "pwaReport", "sourceManifest", "currentSourceManifest", "smokeReport", "smokeCommand", "exitCode", "stdout", "stderr", "localOnly", "stagingValidated", "providerValidated"])
    || receipt.schemaVersion !== 1 || receipt.kind !== "planet-local-preparation-validation" || receipt.sourceCommit !== options.expectedHead
    || receipt.localOnly !== true || receipt.stagingValidated !== false || receipt.providerValidated !== false || receipt.exitCode !== 0
    || path.resolve(root, receipt.artifact?.path ?? "") !== path.join(root, dir, "artifact.json")) reject("INVALID_RECEIPT");
  const artifactBytes = await readRef(receipt.artifact);
  const artifact = JSON.parse(artifactBytes);
  if (artifact.schemaVersion !== 1 || artifact.kind !== "literary-planet-controlled-pwa-preparation" || artifact.sourceCommit !== options.expectedHead
    || artifact.buildId !== options.expectedBuildId || artifact.profile !== "SAFE_PAID_BILINGUAL_V1" || artifact.scopePath !== "/planet/"
    || artifact.commercialModel !== "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES" || !same(artifact.requiredLocales, ["ru", "en"]) || artifact.releaseReady !== false || artifact.productionActionsAuthorized !== false
    || typeof artifact.localQaAuthority !== "boolean" || (artifact.localQaAuthority && !options.allowQa)) reject("WRONG_ARTIFACT");
  const pwaReportBytes = await readRef(receipt.pwaReport);
  const verification = JSON.parse(pwaReportBytes);
  if (verification.pass !== true || verification.releaseReady !== false || !Array.isArray(verification.findings) || verification.findings.length
    || verification.identity?.buildId !== artifact.buildId || verification.identity?.sourceCommit !== artifact.sourceCommit
    || verification.identity?.localQaAuthority !== artifact.localQaAuthority) reject("INVALID_PWA_REPORT");
  const sourceBytes = await readRef(receipt.sourceManifest);
  const source = JSON.parse(sourceBytes);
  const current = await stagingSourceSnapshot(root, runGit);
  const committedBytes = await readRef(receipt.currentSourceManifest);
  const committed = JSON.parse(committedBytes);
  if (!exact(source, ["schemaVersion", "sourceCommit", "files"]) || source.schemaVersion !== 1 || !/^[a-f0-9]{40}$/u.test(source.sourceCommit ?? "")
    || !exact(committed, ["schemaVersion", "sourceCommit", "files"]) || committed.schemaVersion !== 1 || committed.sourceCommit !== options.expectedHead
    || !same(source.files, current.files) || !same(committed.files, current.files)) reject("STALE_VALIDATION_SOURCE");
  runGit(root, ["merge-base", "--is-ancestor", source.sourceCommit, options.expectedHead]);
  const sourceHashes = new Map(current.files.map(file => [file.path, file.sha256]));
  if (!Array.isArray(artifact.sourceInputs?.files) || !artifact.sourceInputs.files.length) reject("STALE_ARTIFACT_SOURCE");
  for (const file of artifact.sourceInputs.files) {
    if (!exact(file, ["path", "sha256"]) || !hash(file.sha256) || /(?:^|\/)\.env(?:\.|$)/u.test(file.path)) reject("STALE_ARTIFACT_SOURCE");
    // The strict PWA report also owns its named portrait-selection metadata,
    // outside the deliberately narrower local-protocol source snapshot.
    const currentHash = sourceHashes.get(file.path) ?? sha(await existing(root, file.path));
    if (currentHash !== file.sha256) reject("STALE_ARTIFACT_SOURCE");
  }
  const smokeReportBytes = await readRef(receipt.smokeReport);
  const smoke = JSON.parse(smokeReportBytes);
  const command = ["node", "node_modules/vitest/vitest.mjs", "run", ...LOCAL_SMOKE_SUITES, "--maxWorkers=1", "--reporter=json", "--outputFile=" + receipt.smokeReport.path];
  if (!same(receipt.smokeCommand, command) || smoke.success !== true || !Number.isSafeInteger(smoke.numTotalTestSuites) || smoke.numTotalTestSuites < 4 || smoke.numPassedTestSuites !== smoke.numTotalTestSuites || smoke.numFailedTestSuites !== 0 || smoke.numPendingTestSuites !== 0
    || !Number.isSafeInteger(smoke.numTotalTests) || smoke.numTotalTests < 1 || smoke.numPassedTests !== smoke.numTotalTests || smoke.numFailedTests !== 0 || smoke.numPendingTests !== 0 || smoke.numTodoTests !== 0
    || !Array.isArray(smoke.testResults) || smoke.testResults.length !== LOCAL_SMOKE_SUITES.length) reject("FAILED_LOCAL_SMOKE");
  const suiteNames = smoke.testResults.map(suite => path.relative(root, suite.name).split(path.sep).join("/")).sort();
  if (!same(suiteNames, [...LOCAL_SMOKE_SUITES].sort()) || smoke.testResults.some(suite => suite.status !== "passed" || !Array.isArray(suite.assertionResults) || !suite.assertionResults.length || suite.assertionResults.some(test => test.status !== "passed"))
    || smoke.testResults.reduce((sum, suite) => sum + suite.assertionResults.length, 0) !== smoke.numTotalTests) reject("FAILED_LOCAL_SMOKE");
  const smokeStdoutBytes = await readRef(receipt.stdout);
  const smokeStderrBytes = await readRef(receipt.stderr);
  const assets = await candidateFiles(root, dir, artifact);
  const draftBytes = await existing(root, "server/planet/wrangler.draft.jsonc");
  const config = draftConfig(draftBytes);
  const report = { schemaVersion: 1, pass: true, kind: "planet-local-staging-package", target: "local-preparation", profile: artifact.profile, sourceBindingScope: [...STAGING_SOURCE_ROOTS],
    sourceCommit: options.expectedHead, buildId: artifact.buildId, localQaAuthority: artifact.localQaAuthority,
    validationReceipt: options.validationReceipt, sourceManifest: receipt.sourceManifest, currentSourceManifest: receipt.currentSourceManifest,
    localProtocolSmokeRetained: true, localSmokeOriginalSourceCommit: source.sourceCommit, currentSourceFilesUnchangedSinceLocalSmoke: true,
    dryRun: !options.writePackage, packageWritten: false, stagingDeploymentExecuted: false, stagingEntitlementValidated: false,
    realProviderWebhookValidated: false, productionActionsAuthorized: false, releaseReady: false, stageAcceptanceClaimed: false };
  const assertSourceUnchanged = async () => {
    if (!same(current, await stagingSourceSnapshot(root, runGit)) || runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]).trim()) reject("SOURCE_DRIFT");
  };
  if (!options.writePackage) { await assertSourceUnchanged(); return report; }
  const built = await bundle({ absWorkingDir: root, entryPoints: ["server/planet/worker.ts"], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022", external: ["node:*"], metafile: true, logLevel: "silent" });
  if (built.outputFiles?.length !== 1 || !built.outputFiles[0].contents?.length || !built.metafile?.inputs?.["server/planet/worker.ts"]) reject("INVALID_WORKER_BUNDLE");
  await assertSourceUnchanged();
  const packageFiles = new Map([...assets].map(([name, bytes]) => ["pwa/" + name, bytes]));
  packageFiles.set("pwa/artifact.json", artifactBytes);
  packageFiles.set("worker.mjs", built.outputFiles[0].contents);
  packageFiles.set("worker-metafile.json", Buffer.from(json(built.metafile)));
  packageFiles.set("wrangler.local-package.json", Buffer.from(json(config)));
  packageFiles.set("source/server/planet/wrangler.draft.jsonc", draftBytes);
  for (const name of Object.keys(built.metafile.inputs).filter(name => name.startsWith("server/planet/"))) {
    const bytes = await existing(root, name);
    if (sha(bytes) !== sourceHashes.get(name)) reject("SOURCE_DRIFT");
    packageFiles.set("source/" + name, bytes);
  }
  const validationFiles = [
    { packagedPath: "validation/receipt.json", originalReference: options.validationReceipt, bytes: receiptBytes },
    { packagedPath: "validation/source-manifest.json", originalReference: receipt.sourceManifest, bytes: sourceBytes },
    { packagedPath: "validation/current-source-manifest.json", originalReference: receipt.currentSourceManifest, bytes: committedBytes },
    { packagedPath: "validation/pwa-report.json", originalReference: receipt.pwaReport, bytes: pwaReportBytes },
    { packagedPath: "validation/smoke-report.json", originalReference: receipt.smokeReport, bytes: smokeReportBytes },
    { packagedPath: "validation/smoke-stdout.log", originalReference: receipt.stdout, bytes: smokeStdoutBytes },
    { packagedPath: "validation/smoke-stderr.log", originalReference: receipt.stderr, bytes: smokeStderrBytes },
  ];
  for (const file of validationFiles) packageFiles.set(file.packagedPath, file.bytes);
  report.validationMappings = validationFiles.map(file => ({ packagedPath: file.packagedPath, sha256: file.originalReference.sha256, originalReference: file.originalReference }));
  const output = path.join(root, out);
  await mkdir(output);
  for (const [name, bytes] of packageFiles) {
    artifactPath(name);
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }
  const assetHashes = new Map(artifact.inventory.map(entry => ["pwa/" + entry.path, entry.sha256]));
  assetHashes.set("pwa/artifact.json", receipt.artifact.sha256);
  for (const file of validationFiles) assetHashes.set(file.packagedPath, file.originalReference.sha256);
  const inventory = [...packageFiles].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: assetHashes.get(name) ?? sha(bytes) })).sort((a, b) => a.path < b.path ? -1 : 1);
  report.packageWritten = true; report.inventory = inventory; report.packageSha256 = sha(json(inventory));
  await assertSourceUnchanged();
  // Final success marker is written last. Partial failure never has a success receipt.
  await writeFile(path.join(output, "result.json"), json(report), { flag: "wx" });
  return report;
}
