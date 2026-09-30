import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import vm from 'node:vm';
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const base = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(base, 'actual-a1');
const checkpoint = '9334959be89d3a319879bd3134c79b5c529c7ec8';
const runtimeSourceCommit = 'aba461a774c125f9c38ea4c10aac9b3cc8024d2d';
const sha = data => createHash('sha256').update(data).digest('hex');
const hash = async p => sha(await fs.readFile(p));
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const ref = async p => ({ path: p.replaceAll('\\', '/'), sha256: await hash(p) });
const write = async (name, data) => { const p = path.join(out, name); await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); return ref(p); };
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', 'safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work', ...args], { cwd: root, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, maxBuffer: 64 * 1024 * 1024 });
const textgit = (...args) => git(...args).toString('utf8').trim();
assert.equal(textgit('rev-parse', 'HEAD'), checkpoint);
assert.equal(textgit('status', '--porcelain'), '');
const proposalPath = path.join(base, 'proposal.json');
assert.equal(await hash(proposalPath), '97210ad8281d89377d4e76ca0029d64138d45cf1694707f05a444f1e8407b511');
const proposal = await read(proposalPath);
assert.equal(proposal.sourceCommit, runtimeSourceCommit);
assert.equal(proposal.files.length, 6);
const priorPath = path.join(base, '../s15-booky-exhausted-retry-assessment-review/runtime-fix-a6/source-manifest.json');
assert.equal(await hash(priorPath), '555b4c84f613941df20da33259cf7880e5ef2737252e2810807143f311dea324');
const prior = await read(priorPath);
assert.equal(prior.files.length, 1665);
for (const f of prior.files) assert.equal(await hash(path.join(root, f.path)), f.sha256, f.path);
for (const f of proposal.files) {
  assert.equal(await hash(path.join(root, f.relativePath)), f.before.sha256);
  assert.equal(await hash(f.before.path), f.before.sha256);
  assert.equal(await hash(f.proposed.path), f.proposed.sha256);
}
for (const binding of proposal.sourceBindings) {
  assert.equal(await hash(path.join(root, binding.relativePath)), binding.rawSha256);
  assert.equal(textgit('log', '-1', '--format=%H', '--', binding.relativePath), runtimeSourceCommit);
  assert.equal(sha(git('cat-file', 'blob', `${runtimeSourceCommit}:${binding.relativePath}`)), binding.gitBlobSha256);
}
// Direct semantic review of the two literal inventories, without importing them into the application.
const { transformSync } = createRequire(path.join(root, 'package.json'))('esbuild');
async function literal(file) {
  const source = await fs.readFile(file, 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.module.exports));
}
for (const [filename, key, retained] of [
  ['bookyNavigationDrafts.ts', 'BOOKY_NAVIGATION_DRAFTS', 22],
  ['bookyDialogueDrafts.ts', 'BOOKY_DIALOGUE_DRAFTS', 12],
]) {
  const f = proposal.files.find(f => f.relativePath.endsWith('/' + filename));
  const before = (await literal(f.before.path))[key], after = (await literal(f.proposed.path))[key];
  assert.equal(before.length, retained);
  assert.equal(after.length, filename.includes('Navigation') ? 22 : 14);
  for (let i = 0; i < retained; i++) {
    if (filename.includes('Navigation') && i < 14) { assert.deepEqual(after[i], before[i]); continue; }
    const a = structuredClone(before[i]), b = structuredClone(after[i]);
    for (const row of [a, b]) { delete row.payload.provenance; delete row.review.contentChecksum; delete row.checksum; }
    if (filename.includes('Navigation')) {
      assert.equal(a.payload.version, 6); assert.equal(b.payload.version, 7);
      delete a.payload.version; delete b.payload.version;
    }
    assert.deepEqual(a, b, filename + ':' + i);
  }
  for (const record of after) {
    assert.equal(record.review.status, 'draft'); assert.equal(record.review.reviewer, null); assert.equal(record.review.reviewedAt, null);
    assert.equal(record.payload.narration, null);
  }
  if (retained === 12) {
    assert.deepEqual(after.slice(12).map(r => [r.payload.id, r.payload.locale]), [['support.books-error-restart', 'ru'], ['support.books-error-restart', 'en']]);
  }
}
await fs.mkdir(out);
for (const f of proposal.files) await fs.copyFile(f.proposed.path, path.join(root, f.relativePath));
const files = await Promise.all(prior.files.map(async f => ({ path: f.path, sha256: await hash(path.join(root, f.path)) })));
const changedPaths = proposal.files.map(f => f.relativePath).sort();
assert.deepEqual(files.filter((f, i) => f.sha256 !== prior.files[i].sha256).map(f => f.path).sort(), changedPaths);
assert.deepEqual(textgit('diff', '--name-only').split('\n').sort(), changedPaths);
const manifest = await write('source-manifest.json', { schemaVersion: 1, checkpoint, files });
const entry = await write('entry.json', { schemaVersion: 1, checkpoint, runtimeSourceCommit, proposal: await ref(proposalPath),
  priorSourceManifest: await ref(priorPath), sourceManifest: { ...manifest, fileCount: 1665 }, sourceInputCount: 1665, protectedInputCount: 1659,
  changedPaths, metadataOnly: true, runtimeUnchanged: true, oldCopyAndScopePreserved: true, navigationV2Retained: 14,
  contextualRevision: 7, supportProvenanceRevision: 2, newSupportDrafts: 2, combinedDraftCount: 36, stageAccepted: false, releaseReady: false });
async function run(name, args) {
  const command = [process.execPath, ...args], stdout = [], stderr = [], began = Date.now();
  let error = null;
  const exitCode = await new Promise(resolve => {
    const child = spawn(command[0], command.slice(1), { cwd: root, windowsHide: true, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => stdout.push(chunk)); child.stderr.on('data', chunk => stderr.push(chunk));
    child.once('error', e => { error = e.message; }); child.once('close', resolve);
  });
  const logs = {};
  for (const [label, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
    const p = path.join(out, `${name}-${label}.log`); await fs.writeFile(p, Buffer.concat(chunks), { flag: 'wx' }); logs[label] = await ref(p);
  }
  let rawReport, summary;
  try {
    if (name === 'unit') {
      rawReport = await ref(path.join(out, 'unit-report.json')); const raw = await read(rawReport.path);
      summary = { total: raw.numTotalTests, passed: raw.numPassedTests, failed: raw.numFailedTests, pending: raw.numPendingTests };
      assert.equal(raw.success, true); assert.equal(summary.failed, 0); assert.equal(summary.pending, 0); assert(summary.passed > 0);
    } else {
      const raw = JSON.parse(Buffer.concat(stdout).toString('utf8')); assert.equal(raw.pass, true);
      rawReport = await write(`${name}-report.json`, raw); summary = { pass: raw.pass, findings: raw.findings };
    }
  } catch (e) { error = String(e.stack || e); }
  const result = { name, command, exitCode, error, durationMs: Date.now() - began, pass: exitCode === 0 && error === null,
    entry, sourceManifest: manifest, ...logs, rawReport, summary, producer: await ref(fileURLToPath(import.meta.url)) };
  const resultRef = await write(`${name}-result.json`, result);
  console.log(JSON.stringify({ name, pass: result.pass, summary, result: resultRef }));
  return { pass: result.pass, ref: resultRef };
}
const results = await Promise.all([
  run('unit', [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'src/host/bookyDialogueDrafts.test.ts', 'src/host/bookyNavigationDrafts.test.ts', '--reporter=json', `--outputFile=${path.join(out, 'unit-report.json')}`]),
  run('support-inventory', [await fs.realpath(path.join(root, 'scripts/mobile/verify-booky-dialogue-drafts.mjs'))]),
  run('navigation-inventory', [await fs.realpath(path.join(root, 'scripts/mobile/verify-booky-navigation-drafts.mjs'))]),
]);
for (const f of files) assert.equal(await hash(path.join(root, f.path)), f.sha256, f.path);
const result = await write('checks-result.json', { pass: results.every(r => r.pass), entry, sourceManifest: manifest,
  results: results.map(r => r.ref), sourceInputsUnchanged: true, sourceInputCount: 1665, protectedInputCount: 1659,
  runtimeSourceCommit, runtimeUnchanged: true, testsRun: true, inventoryAuditsRun: 2, typescriptRun: false, browserRun: false, buildsRun: false,
  stageAccepted: false, releaseReady: false });
console.log(JSON.stringify({ pass: results.every(r => r.pass), result }));
if (results.some(r => !r.pass)) process.exitCode = 1;
