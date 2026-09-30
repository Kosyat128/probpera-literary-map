import fs from 'node:fs/promises';
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
const canonical = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const root = await fs.realpath(canonical), admin = path.join(root, 'apps/admin');
const out = path.join(base, 'admin-build-a1'), temp = path.join(root, '.tmp/admin-journey-fact-build-a1');
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
assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(receipt.sourceManifest?.sha256, manifestSha);
assert.equal(await fs.realpath(receipt.sourceManifest.path), manifestPath);
assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
assert.equal(new Set(manifest.files.map(f => f.path)).size, manifest.files.length);
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
}
catch (error) { failure = failure ? `${failure}; source after: ${error.message}` : error.message; }
const pass = !failure && build?.pass === true && secrets?.pass === true;
const result = { schemaVersion: 1, kind: 'booky-journey-fact-admin-build', pass, sourceCommit,
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
