import fs from 'node:fs/promises';
// Proposal hashes bind the frozen external proposals; root acceptance is required before execution.
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// node admin-build.mjs SOURCE_COMMIT MANIFEST_PATH MANIFEST_SHA RECEIPT_PATH RECEIPT_SHA
const [sourceCommit, manifestArg, manifestSha, receiptArg, receiptSha] = process.argv.slice(2);
assert.equal(process.argv.length, 7, 'Supply the committed source, final manifest and source-commit receipt.');
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
for (const digest of [manifestSha, receiptSha]) assert.match(digest, /^[a-f0-9]{64}$/);
const self = fileURLToPath(import.meta.url), base = path.dirname(self);
const bindingPath=path.join(base,'predecessor-binding.json'),binding=JSON.parse(await fs.readFile(bindingPath,'utf8'));
assert.equal(binding.schemaVersion,1);assert.equal(binding.decision,'D234');assert.match(binding.docsCommit,/^[a-f0-9]{40}$/u);assert.match(binding.result.sha256,/^[a-f0-9]{64}$/u);
const canonical = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const root = await fs.realpath(canonical), admin = path.join(root, 'apps/admin');
const out = path.join(base, 'admin-build-a1'), temp = path.join(root, '.tmp/admin-journey-entity-search-build-a1');
const normalize = p => path.normalize(p).replaceAll('\\', '/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = async p => sha(await fs.readFile(p));
const ref = async p => ({ path: normalize(p), sha256: await hash(p) });
const write = async (name, value) => {
  const p = path.join(out, name);
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return ref(p);
};
const manifestPath = await fs.realpath(manifestArg), receiptPath = await fs.realpath(receiptArg);
assert.equal(await hash(manifestPath), manifestSha, 'Final manifest hash');
assert.equal(await hash(receiptPath), receiptSha, 'Source-commit receipt hash');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
assert.equal(receipt.pass, true, 'Source commit must have passed');
assert.equal(receipt.decision, 'D235');
assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(receipt.predecessorDocsCommit,binding.docsCommit);assert.equal(receipt.predecessorResult.sha256,binding.result.sha256);assert.equal(receipt.predecessorBinding.sha256,await hash(bindingPath));
assert.equal(receipt.typecheckExecuted,true);assert.equal(receipt.unitExecuted,false);assert.equal(receipt.protectedInputCount,2099);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','authenticatedAdminSession','stageAccepted','releaseReady'])assert.equal(receipt[k],false);
assert.equal(receipt.retainedUnit.decision,'D230');assert.equal(receipt.retainedUnit.passed,49);assert.equal(receipt.retainedUnit.rerun,false);assert.equal(receipt.retainedUnit.coversNewUi,false);
for(const k of ['originalUnitManifestRetained','currentCoreAndTestSourceUnchangedSinceD230','currentCoreRuntimeUnchanged','emittedTestRuntimeUnchanged','protectedDependenciesUnchanged'])assert.equal(receipt.retainedUnit[k],true);
assert.equal(receipt.retainedUnit.sourceManifest.sha256,'b22f3d63a1f10a53084fa0a7d741c7e4b0a8385099a52a580d0804e02206b505');assert.equal(receipt.retainedUnit.testTypeCorrection.sha256,'8a195fbfc0d4c11847b2aa0f2b40144d973e5411ef21b2e2026024f580797d39');
assert.deepEqual(receipt.changedPaths,['apps/admin/components/BookyJourneyDraftEditor.tsx','tests/host/booky-journey-authoring.spec.mjs']);assert.deepEqual(receipt.newPaths,[]);
assert.deepEqual(receipt.proposalFiles,[{path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'fc18ce97b2033ed0f3ee9ac8ea54b93ba08beb7a6bea8517f18b90cf6433dc89'},{path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'50b049f51c8688a821891c8468353fead3a00e3733ce04f2ae9404b2da86168d'}]);
assert.equal(receipt.sourceManifest?.sha256, manifestSha);
assert.equal(await fs.realpath(receipt.sourceManifest.path), manifestPath);
assert.ok(Array.isArray(manifest.files) && manifest.files.length === 2101);
assert.equal(new Set(manifest.files.map(f => f.path)).size, manifest.files.length);
assert.equal(manifest.checkpoint,binding.docsCommit);
for(const f of receipt.proposalFiles)assert.equal(manifest.files.find(m=>m.path===f.path)?.sha256,f.sha256);
assert.equal(manifest.files.find(f=>f.path==='apps/admin/lib/booky-journey-draft.ts')?.sha256,'eae1d1f0ddfe9ebce77fd2b0b0ae6fe1af8bcb6c3834cae5a70d553fcc19a5ea');assert.equal(manifest.files.find(f=>f.path==='apps/admin/lib/booky-journey-draft.test.ts')?.sha256,'05a17d7c98e3027b4a935c5a72b1fb93d79abc75d6089a6bfac0882cc23c43e6');
for (const f of manifest.files) {
  assert.equal(typeof f.path, 'string');
  assert.ok(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'), f.path);
  assert.match(f.sha256, /^[a-f0-9]{64}$/);
}
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', TEMP: temp, TMP: temp,
  GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: normalize(canonical),
  GIT_CONFIG_KEY_1: 'safe.directory', GIT_CONFIG_VALUE_1: normalize(root),
  GIT_CONFIG_KEY_2: 'core.autocrlf', GIT_CONFIG_VALUE_2: 'true' };
function git(args) {
  const r = spawnSync('git', args, { cwd: root, env, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr || r.error?.message || `git ${args[0]} failed`);
  return r.stdout.trim();
}
async function snapshot() {
  return { sourceCommit: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain=v1', '--untracked-files=all']),
    files: await Promise.all(manifest.files.map(async f => ({ path: f.path, sha256: await hash(path.join(root, f.path)) }))) };
}
function checkSnapshot(value) {
  assert.equal(value.sourceCommit, sourceCommit, 'HEAD must remain the supplied source commit');
  assert.equal(value.status, '', 'The committed checkout must be clean');
  for (const f of value.files) assert.equal(f.sha256, manifest.files.find(p => p.path === f.path).sha256, f.path);
}
async function run(label, args) {
  const stdoutPath = path.join(out, `${label}.stdout.log`), stderrPath = path.join(out, `${label}.stderr.log`);
  const stdout = await fs.open(stdoutPath, 'wx'), stderr = await fs.open(stderrPath, 'wx'), started = Date.now();
  let spawnError = null;
  console.log(JSON.stringify({ started: label, command: [process.execPath, ...args], sourceCommit }));
  const execution = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: admin, env, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
    child.once('error', error => { spawnError = error.message; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  await stdout.close(); await stderr.close();
  return { ...execution, pass: execution.exitCode === 0 && !spawnError, spawnError, durationMs: Date.now() - started,
    command: [process.execPath, ...args], cwd: normalize(admin), stdout: await ref(stdoutPath), stderr: await ref(stderrPath) };
}

await fs.mkdir(out); // Never overwrite an earlier build attempt.
await fs.mkdir(temp, { recursive: true });
let before = null, after = null, build = null, secrets = null, failure = null;
const started = Date.now();
try {
  before = await snapshot(); await write('source-before.json', before); checkSnapshot(before);
  assert.match(manifest.checkpoint, /^[a-f0-9]{40}$/);
  git(['merge-base', '--is-ancestor', manifest.checkpoint, sourceCommit]);
  const next = await fs.realpath(createRequire(path.join(admin, 'package.json')).resolve('next/dist/bin/next'));
  build = await run('next-build', [next, 'build', '--webpack']);
  if (build.pass) {
    // This script's primary-CLI guard requires argv and import.meta realpaths to agree.
    const audit = await fs.realpath(path.join(root, 'scripts/check-admin-client-secrets.mjs'));
    secrets = await run('client-secrets', [audit]);
    assert.ok(!secrets.pass || (await fs.stat(path.join(out, 'client-secrets.stdout.log'))).size > 0, 'Secret audit returned no output');
  }
} catch (error) { failure = error.message; }
try {
  after = await snapshot(); await write('source-after.json', after); checkSnapshot(after);
  assert.equal(await hash(manifestPath), manifestSha, 'Final manifest must remain unchanged');
  assert.equal(await hash(receiptPath), receiptSha, 'Commit receipt must remain unchanged');
  assert.equal(await hash(bindingPath),receipt.predecessorBinding.sha256,'Predecessor binding must remain unchanged');
}
catch (error) { failure = failure ? `${failure}; source after: ${error.message}` : error.message; }
const pass = !failure && build?.pass === true && secrets?.pass === true;
const result = { schemaVersion: 1, kind: 'booky-journey-entity-search-admin-build', pass, sourceCommit,
  sourceManifest: await ref(manifestPath), sourceCommitReceipt: await ref(receiptPath),
  durationMs: Date.now() - started, build, clientSecrets: secrets, failure,
  sourceBefore: before ? await ref(path.join(out, 'source-before.json')) : null,
  sourceAfter: after ? await ref(path.join(out, 'source-after.json')) : null,
  sourceInputsUnchanged: !failure && before !== null && after !== null,
  standaloneTypecheckExecuted: false, catalogGenerationExecuted: false, mobileBuildExecuted: false, deploymentExecuted: false,
  stageAccepted: false, releaseReady: false, producer: await ref(self) };
const resultRef = await write('result.json', result);
console.log(JSON.stringify({ pass, sourceCommit, result: resultRef, failure }));
if (!pass) process.exitCode = 1;
