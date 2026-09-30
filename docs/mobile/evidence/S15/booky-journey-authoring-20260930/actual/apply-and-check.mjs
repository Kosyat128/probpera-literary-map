import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const base = path.dirname(fileURLToPath(import.meta.url)), out = path.join(base, 'actual-a1');
const checkpoint = '00ab73ff2e2be05da62c7e4b7b14718dca048a0b';
const paths = ['apps/admin/app/(dashboard)/journeys/page.tsx', 'apps/admin/components/BookyJourneyDraftEditor.tsx',
  'apps/admin/lib/admin-module-registry.ts', 'apps/admin/lib/booky-journey-catalog.ts',
  'apps/admin/lib/booky-journey-draft.test.ts', 'apps/admin/lib/booky-journey-draft.ts',
  'tests/host/booky-journey-authoring.spec.mjs'].sort();
const sha = b => createHash('sha256').update(b).digest('hex');
const hash = async p => sha(await fs.readFile(p));
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const ref = async p => ({ path: p.replaceAll('\\', '/'), sha256: await hash(p) });
const write = async (name, value) => { const p = path.join(out, name); await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return ref(p); };
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', 'safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work', ...args], { cwd: root, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, maxBuffer: 64 * 1024 * 1024 }).toString('utf8').trim();
assert.equal(git('rev-parse', 'HEAD'), checkpoint); assert.equal(git('status', '--porcelain'), '');
const priorPath = path.join(base, '../s15-booky-dialogue-provenance-rev7-review/actual-a1/source-manifest.json');
const prior = await read(priorPath);
assert.equal(prior.files.length, 1665);
for (const f of prior.files) assert.equal(await hash(path.join(root, f.path)), f.sha256, f.path);
const adminPaths = git('ls-files', '--', 'apps/admin').split('\n');
const baselinePaths = [...new Set([...prior.files.map(f => f.path), ...adminPaths])].sort();
const baselineFiles = await Promise.all(baselinePaths.map(async p => ({ path: p, sha256: await hash(path.join(root, p)) })));
const proposed = await Promise.all(paths.map(async p => ({ path: p, proposal: await ref(path.join(base, 'proposed', p)) })));
await fs.mkdir(out);
const baselineManifest = await write('baseline-manifest.json', { schemaVersion: 1, checkpoint, files: baselineFiles });
for (const p of proposed) {
  const target = path.join(root, p.path);
  assert(path.resolve(target).startsWith(path.resolve(root) + path.sep));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(p.proposal.path, target);
}
const files = await Promise.all([...new Set([...baselinePaths, ...paths])].sort().map(async p => ({ path: p, sha256: await hash(path.join(root, p)) })));
const before = new Map(baselineFiles.map(f => [f.path, f.sha256]));
assert.deepEqual(files.filter(f => f.sha256 !== before.get(f.path)).map(f => f.path), paths);
const manifest = await write('source-manifest.json', { schemaVersion: 1, checkpoint, files });
const newPaths = paths.filter(p => !before.has(p));
assert.equal(newPaths.length, 6);
assert.deepEqual(git('diff', '--name-only').split('\n'), ['apps/admin/lib/admin-module-registry.ts']);
assert.deepEqual(git('ls-files', '--others', '--exclude-standard').split('\n').sort(), newPaths);
const entry = await write('entry.json', { schemaVersion: 1, checkpoint, sourceManifest: { ...manifest, fileCount: files.length }, baselineManifest,
  previousMobileSourceManifest: await ref(priorPath), sourceInputCount: files.length, protectedInputCount: files.length - paths.length,
  changedPaths: paths, newPaths, proposed, adminImplementationChanged: true, mobileRuntimeUnchanged: true,
  retainedMobileRuntimeSourceCommit: 'aba461a774c125f9c38ea4c10aac9b3cc8024d2d',
  productionJourneysEnabled: false, stageAccepted: false, releaseReady: false });
async function run(name, args, parse) {
  const stdout = [], stderr = [], command = [process.execPath, ...args], began = Date.now(); let error = null;
  const exitCode = await new Promise(resolve => {
    const child = spawn(command[0], command.slice(1), { cwd: root, windowsHide: true, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', b => stdout.push(b)); child.stderr.on('data', b => stderr.push(b));
    child.once('error', e => { error = e.message; }); child.once('close', resolve);
  });
  const logs = {};
  for (const [label, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
    const p = path.join(out, name + '-' + label + '.log'); await fs.writeFile(p, Buffer.concat(chunks), { flag: 'wx' }); logs[label] = await ref(p);
  }
  let summary = null, rawReport = null;
  try {
    if (parse === 'unit') {
      rawReport = await ref(path.join(out, 'unit-report.json')); const r = await read(rawReport.path);
      summary = { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, pending: r.numPendingTests };
      assert(r.success && summary.passed > 0 && summary.failed === 0 && summary.pending === 0);
    } else if (parse === 'json') {
      summary = JSON.parse(Buffer.concat(stdout).toString('utf8')); assert.equal(summary.pass, true); rawReport = await write(name + '-report.json', summary);
    }
  } catch (e) { error = String(e.stack || e); }
  const result = { name, pass: exitCode === 0 && error === null, command, exitCode, error, durationMs: Date.now() - began, summary, rawReport, ...logs,
    entry, sourceManifest: manifest, producer: await ref(fileURLToPath(import.meta.url)) };
  const resultRef = await write(name + '-result.json', result);
  console.log(JSON.stringify({ name, pass: result.pass, summary, result: resultRef }));
  return { pass: result.pass, result: resultRef };
}
const results = await Promise.all([
  run('unit', [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'apps/admin/lib/booky-journey-draft.test.ts', 'apps/admin/lib/admin-module-coverage.test.ts', '--reporter=json', '--outputFile=' + path.join(out, 'unit-report.json')], 'unit'),
  run('admin-types', [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'apps/admin/tsconfig.json', '--incremental', 'false']),
  run('catalog-smoke', [path.join(base, 'catalog-smoke.mjs')], 'json'),
]);
for (const f of files) assert.equal(await hash(path.join(root, f.path)), f.sha256, f.path);
const result = await write('checks-result.json', { pass: results.every(r => r.pass), entry, sourceManifest: manifest, results: results.map(r => r.result),
  sourceInputCount: files.length, protectedInputCount: files.length - paths.length, sourceInputsUnchanged: true,
  mobileRuntimeUnchanged: true, browserRun: false, buildsRun: false, stageAccepted: false, releaseReady: false });
console.log(JSON.stringify({ pass: results.every(r => r.pass), result }));
if (results.some(r => !r.pass)) process.exitCode = 1;
