import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ALIAS = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const ROOT = await fs.realpath(ALIAS);
const TITLE = "offline PWA cross-language author search and book return retain the globe and integrated archive card";
const CAPTURES = ["pwa-premium-globe-ru.png", "pwa-premium-menu-ru.png", "pwa-premium-globe-en.png", "pwa-premium-menu-en.png"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const git = args => execFileSync("git", ["--no-optional-locks", "-c", "safe.directory=" + ROOT, "-c", "safe.directory=" + ALIAS, ...args],
  { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, maxBuffer: 8 * 1024 * 1024 }).trim();
async function checked(ref, limit = 16 * 1024 * 1024) {
  assert.ok(ref && path.isAbsolute(ref.path)); assert.match(ref.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(await fs.realpath(ref.path), path.resolve(ref.path));
  const stat = await fs.lstat(ref.path); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit);
  const bytes = await fs.readFile(ref.path); assert.equal(sha(bytes), ref.sha256, ref.path); return bytes;
}
const reference = async filename => ({ path: filename, sha256: sha(await fs.readFile(filename)) });
assert.equal(process.argv.length, 4, "node producer.mjs SELF_SHA ROOT_BINDING_SHA");
await checked({ path: fileURLToPath(import.meta.url), sha256: process.argv[2] });
const bindingRef = { path: path.join(HERE, "root-binding.json"), sha256: process.argv[3] };
const binding = JSON.parse(await checked(bindingRef));
assert.equal(binding.schemaVersion, 1); assert.equal(binding.kind, "s03-premium-interface-round2-qa"); assert.equal(binding.bindingReady, true);
assert.match(binding.sourceCommit, /^[a-f0-9]{40}$/u); assert.match(binding.outputName, /^actual-[a-z0-9]+$/u);
assert.deepEqual(binding.helpers.map(ref => path.basename(ref.path)).sort(), ["producer.mjs", "pwa.config.mjs"]);
for (const ref of binding.helpers) { assert.equal(path.resolve(path.dirname(ref.path)), HERE); await checked(ref, 1024 * 1024); }
assert.equal(binding.helpers.find(ref => path.basename(ref.path) === "producer.mjs").sha256, process.argv[2]);
for (const key of ["fullHelperBytesReviewed", "onePwaCompilation", "oneOfflineBrowserCase", "noSmokeOrPackaging"]) assert.equal(binding.rootReview[key], true);
const sourceBytes = await checked(binding.sourceManifest), source = JSON.parse(sourceBytes);
assert.equal(source.schemaVersion, 1); assert.equal(source.sourceCommit, binding.sourceCommit);
assert.ok(binding.additionalInputs.some(ref => ref.path === "supabase/schema.sql"));
assert.equal(await fs.realpath("."), ROOT); assert.equal(await fs.realpath(git(["rev-parse", "--show-toplevel"])), ROOT);
const { stagingSourceSnapshot, STAGING_SOURCE_ROOTS } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/pwa-staging-package.mjs")));
assert.equal(STAGING_SOURCE_ROOTS.length, 13);
async function verifySource() {
  assert.equal(git(["rev-parse", "HEAD"]), binding.sourceCommit);
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  assert.deepEqual(await stagingSourceSnapshot(ROOT), source);
  await checked(bindingRef); await checked(binding.sourceManifest);
  for (const ref of binding.helpers) await checked(ref, 1024 * 1024);
  for (const ref of [...binding.additionalInputs, ...binding.tools]) {
    assert.ok(typeof ref.path === "string" && !path.isAbsolute(ref.path) && !/(?:^|\/)\.\.(?:\/|$)|(?:^|\/)\.env(?:\.|$)/u.test(ref.path));
    const filename = path.resolve(ROOT, ref.path), relative = path.relative(ROOT, filename);
    assert.ok(relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
    await checked({ ...ref, path: filename });
  }
}
await verifySource();
const OUT = path.join(HERE, binding.outputName);
await assert.rejects(fs.lstat(OUT), { code: "ENOENT" }); await fs.mkdir(OUT);
const save = async (name, value) => {
  const filename = path.join(OUT, name);
  await fs.writeFile(filename, Buffer.isBuffer(value) || typeof value === "string" ? value : json(value), { flag: "wx" });
  return reference(filename);
};
await save("binding.json", await checked(bindingRef)); await save("source-before.json", sourceBytes);
const suffix = "s03-premium-round2-" + binding.outputName;
const authorityPath = ".tmp/pwa-qa/" + suffix + "-authority.json", controlPath = ".tmp/pwa-qa/" + suffix + "-server.json";
const temporary = path.join(ROOT, ".tmp", suffix + "-temp");
for (const filename of [path.join(ROOT, authorityPath), path.join(ROOT, controlPath), temporary]) await assert.rejects(fs.lstat(filename), { code: "ENOENT" });
await fs.mkdir(path.join(ROOT, ".tmp"), { recursive: true });
assert.equal(await fs.realpath(path.join(ROOT, ".tmp")), path.join(ROOT, ".tmp")); await fs.mkdir(temporary);
Object.assign(process.env, { TEMP: temporary, TMP: temporary, PWA_QA_CONTROL_PATH: controlPath, S03_BROWSER_CHANNEL: "msedge",
  S03_PWA_OUTPUT: path.join(OUT, "browser"), S03_PWA_REPORT: path.join(OUT, "browser-playwright.json"),
  GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: ROOT, GIT_CONFIG_KEY_1: "safe.directory", GIT_CONFIG_VALUE_1: ALIAS });
const commands = [];
async function command(label, args) {
  const approved = await save(label + "-command.json", { executable: process.execPath, cwd: ROOT, args });
  const chunks = { stdout: [], stderr: [] }; let exitCode = null, signal = null, error = null;
  const started = Date.now();
  await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of ["stdout", "stderr"]) child[stream].on("data", bytes => chunks[stream].push(bytes));
    child.once("error", failure => { error = failure.message; resolve(); });
    child.once("close", (code, reason) => { exitCode = code; signal = reason; resolve(); });
  });
  const stdout = Buffer.concat(chunks.stdout), stderr = Buffer.concat(chunks.stderr);
  const execution = { command: approved, exitCode, signal, error, durationMs: Date.now() - started,
    stdout: await save(label + ".stdout.txt", stdout), stderr: await save(label + ".stderr.txt", stderr) };
  const executionRef = await save(label + "-execution.json", execution); commands.push({ label, execution: executionRef });
  return { ...execution, execution: executionRef, stdoutText: stdout.toString("utf8") };
}
let server, artifact, strictAudit, browser, failure = null, signerClosed = false, buildInvocations = 0, browserInvocations = 0, requests = [];
try {
  const { startPwaQaServer } = await import(pathToFileURL(path.join(ROOT, "tests/pwa/support/local-server.mjs")));
  buildInvocations++; const started = Date.now();
  // Exactly one PWA compiler request. Its inherited output is retained by ROOT's
  // launcher; no smoke, packaging or second build occurs in this producer.
  server = await startPwaQaServer({ root: ROOT, port: 0, buildQa: true, authorityPath, controlPath });
  process.env.PWA_QA_ORIGIN = server.origin;
  artifact = JSON.parse(await fs.readFile(path.join(ROOT, "dist-pwa", "artifact.json"), "utf8"));
  assert.equal(artifact.sourceCommit, binding.sourceCommit); assert.equal(artifact.localQaAuthority, true);
  assert.equal(artifact.releaseReady, false); assert.equal(artifact.productionActionsAuthorized, false);
  const { pwaAuthoritySha256 } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/pwa-artifact.mjs")));
  assert.equal(artifact.authoritySha256, pwaAuthoritySha256(server.authority));
  assert.ok(!Object.hasOwn(server.authority.trustedKeys[0].jwk, "d"));
  await save("build-execution.json", { pass: true, sourceCommit: binding.sourceCommit, buildId: artifact.buildId, durationMs: Date.now() - started,
    producer: "startPwaQaServer({buildQa:true}) -> build-pwa.mjs --qa-authority", buildInvocations: 1, origin: server.origin, privateKeyPersisted: false });
  await verifySource();
  const audited = await command("strict-audit", ["scripts/mobile/verify-pwa-artifact.mjs", "--allow-qa"]);
  const audit = JSON.parse(audited.stdoutText);
  assert.equal(audited.exitCode, 0); assert.equal(audit.pass, true);
  assert.equal(audit.identity.buildId, artifact.buildId); assert.equal(audit.identity.sourceCommit, binding.sourceCommit); assert.equal(audit.identity.localQaAuthority, true);
  strictAudit = { report: await save("strict-audit.json", audit), execution: audited.execution };
  browserInvocations++;
  const run = await command("browser", ["node_modules/@playwright/test/cli.js", "test", "--config=" + path.join(HERE, "pwa.config.mjs")]);
  const report = JSON.parse(await fs.readFile(process.env.S03_PWA_REPORT, "utf8")), specs = [];
  const visit = suite => { specs.push(...(suite.specs ?? [])); for (const nested of suite.suites ?? []) visit(nested); };
  for (const suite of report.suites ?? []) visit(suite);
  assert.equal(run.exitCode, 0); assert.equal(report.stats.expected, 1);
  for (const key of ["unexpected", "skipped", "flaky"]) assert.equal(report.stats[key], 0);
  assert.equal(specs.length, 1);
  assert.deepEqual(specs.map(spec => spec.title), [TITLE]);
  const main = specs[0];
  for (const spec of specs) {
    assert.equal(spec.tests.length, 1); assert.equal(spec.tests[0].projectName, "s03-premium-msedge-390");
    assert.equal(spec.tests[0].results.length, 1); assert.equal(spec.tests[0].results[0].status, "passed");
  }
  assert.equal(main.tests.length, 1);
  assert.equal(main.tests[0].projectName, "s03-premium-msedge-390");
  const runs = main.tests[0].results; assert.equal(runs.length, 1); assert.equal(runs[0].status, "passed");
  const attached = runs[0].attachments.find(item => item.name === "pwa-country-writer-return-evidence");
  assert.equal(attached?.contentType, "application/json");
  const body = Buffer.from(attached.body, "base64"); assert.ok(body.length <= 64 * 1024);
  const observation = JSON.parse(body); assert.equal(observation.localQaOnly, true);
  assert.deepEqual(observation.observations.map(item => item.locale), ["ru", "en"]);
  for (const item of observation.observations) {
    for (const key of ["canonicalSearchIds", "readerClosed", "collectionClosed", "writerRevealedByProduct", "focusWithinCountryCard", "sameCanvasRendererCameraScene", "offline", "menuDismissedByEscape", "menuTriggerFocusRestored"]) assert.equal(item[key], true);
    assert.equal(item.country, "russia"); assert.equal(item.writer, "dostoevsky");
    assert.deepEqual(item.loadedFlags.map(flag => flag.locale), ["ru", "en"]);
    for (const flag of item.loadedFlags) {
      assert.equal(flag.asset, "assets/country-flags/" + (flag.locale === "ru" ? "ru" : "gb") + ".svg");
      assert.equal(flag.loaded, true); assert.equal(flag.selected, flag.locale === item.locale);
    }
    assert.equal(item.directTargets.length, 3); assert.ok(item.menuTargets.length >= 4);
    assert.ok([...item.directTargets, ...item.menuTargets].every(rect => rect.width >= 44 && rect.height >= 44));
  }
  const found = new Map();
  async function walk(directory, depth = 0) {
    assert.ok(depth <= 6);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink()); const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename, depth + 1);
      else if (CAPTURES.includes(entry.name)) { assert.ok(!found.has(entry.name)); found.set(entry.name, filename); }
    }
  }
  await walk(process.env.S03_PWA_OUTPUT); assert.deepEqual([...found.keys()].sort(), [...CAPTURES].sort());
  const screenshots = [];
  for (const name of CAPTURES) {
    const filename = found.get(name), bytes = await fs.readFile(filename);
    assert.ok(bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    assert.equal(bytes.readUInt32BE(16), 390); assert.equal(bytes.readUInt32BE(20), 844);
    screenshots.push({ name, path: filename, sha256: sha(bytes), bytes: bytes.length, width: 390, height: 844 });
  }
  browser = { caseTitles: [TITLE], casesPassed: 1, report: await reference(process.env.S03_PWA_REPORT), execution: run.execution, stats: report.stats,
    observation: await save("browser-observation.json", body), screenshots, capturesReviewed: false };
  requests = server.getRequests();
  for (const pathname of ["/__pwa_qa__/control", "/planet/api/license/identity", "/planet/api/license/session"]) assert.ok(requests.some(item => item.method === "POST" && item.pathname === pathname));
  await verifySource(); await save("source-after.json", await stagingSourceSnapshot(ROOT));
} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) {
    requests = server.getRequests();
    try { await server.close(); signerClosed = true; } catch (error) { failure ??= { name: error.name, message: error.message }; }
  }
  const result = { schemaVersion: 1, kind: "s03-premium-interface-round2-qa", recordedAt: new Date().toISOString(), sourceCommit: binding.sourceCommit,
    binding: bindingRef, sourceManifest: binding.sourceManifest, additionalInputs: binding.additionalInputs, buildId: artifact?.buildId ?? null,
    strictAudit: strictAudit ?? null, browser: browser ?? null, pass: !failure && Boolean(strictAudit && browser && signerClosed), failure,
    buildInvocations, browserInvocations, smokeInvocations: 0, packagingInvocations: 0, commandExecutions: commands,
    liveQaAuthority: { privateKeyPersisted: false, sameAuthorityForBuildAndBrowser: Boolean(browser), signerClosed },
    serverRequests: { safeFields: ["method", "pathname"], retentionLimit: 2000, rows: requests.map(({ method, pathname }) => ({ method, pathname })) },
    scope: { currentControlledQaArtifact: Boolean(artifact), oneExistingOfflineCase: Boolean(browser), bilingualOfflineSearchAndBookReturn: Boolean(browser), mobileViewport: { width: 390, height: 844 },
      capturesReviewed: false, actualOsInstallation: false, browserProfileReopened: false, realPurchase: false, providerValidated: false,
      stageAccepted: false, releaseReady: false, productionActionsPerformed: false, old163Rerun: false, oldPackagingRerun: false, extraTypeScriptExecuted: false } };
  await save("result.json", result);
  console.log(json({ pass: result.pass, sourceCommit: result.sourceCommit, buildId: result.buildId, captures: browser?.screenshots.length ?? 0, failure }));
  if (!result.pass) process.exitCode = 1;
}
