import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// PREPARED ONLY. Preserve the completed actual run; never run tests or builds.
const root = fs.realpathSync(process.cwd());
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const args = process.argv.slice(2);
assert.ok(args.length === 4 && args[0] === '--source-commit' && /^[a-f0-9]{40}$/.test(args[1])
  && args[2] === '--build-id' && /^[a-f0-9]{64}$/.test(args[3]), 'Exact source/build arguments required');
const [sourceCommit, buildId] = [args[1], args[3]], runId = 'pwa-offline-repair-20260908-a2';
const source = '.tmp/pwa-cross-engine-results/' + runId;
const destination = 'docs/mobile/evidence/S03/offline-repair-20260908/a2';
const archive = `.tmp/pwa-artifacts/${buildId.slice(0, 8)}-offline-repair-20260908-a2`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function safe(relative, existing = true) {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative));
  const filename = path.resolve(root, relative), local = path.relative(root, filename);
  assert.ok(local && !local.startsWith('..') && !path.isAbsolute(local));
  if (existing) { assert.equal(fs.realpathSync(filename), filename); assert.equal(fs.lstatSync(filename).isSymbolicLink(), false); }
  return filename;
}
const read = filename => fs.readFileSync(safe(filename));
const json = filename => JSON.parse(read(filename).toString('utf8').replace(/^\uFEFF/, ''));
const exists = filename => fs.existsSync(safe(filename, false));
function save(filename, value) { fs.writeFileSync(safe(filename, false), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
const run = json(source + '/run-result.json'), session = json(source + '/session.json');
assert.equal(run.runId, runId); assert.equal(run.sourceCommit, sourceCommit); assert.equal(run.buildId, buildId);
assert.equal(run.stageAccepted, false); assert.equal(run.releaseReady, false);
assert.equal(session.artifact.buildId, buildId); assert.equal(session.artifact.sourceCommit, sourceCommit);
assert.equal(exists(destination), false); assert.equal(exists(archive), false);
const artifactBytes = read('dist-pwa/artifact.json'), artifact = JSON.parse(artifactBytes);
assert.equal(artifact.buildId, buildId); assert.equal(artifact.sourceCommit, sourceCommit);
assert.equal(artifact.localQaAuthority, true); assert.equal(artifact.releaseReady, false);
const files = [];
function copy(original, target) {
  const bytes = read(original); fs.writeFileSync(safe(target, false), bytes, { flag: 'wx' }); assert.deepEqual(read(target), bytes);
  const item = { source: original, path: target, bytes: bytes.length, sha256: sha(bytes) }; files.push(item); return item;
}
function walk(directory, callback, relative = '') {
  for (const item of fs.readdirSync(safe(directory + (relative ? '/' + relative : '')), { withFileTypes: true })) {
    assert.equal(item.isSymbolicLink(), false);
    const local = relative ? relative + '/' + item.name : item.name;
    if (item.isDirectory()) walk(directory, callback, local);
    else { assert.ok(item.isFile()); callback(local); }
  }
}
fs.mkdirSync(safe(destination, false));
const reports = ['results.json', 'session.json', 'source-before.json', 'source-after.json', 'source-comparison.json',
  'support-before.json', 'support-after.json', 'strict-artifact-audit.json', 'strict-artifact-audit-execution.json',
  'browser-run-execution.json', 'server-closed.json', 'run-result.json'];
for (const name of reports) if (exists(source + '/' + name)) copy(source + '/' + name, destination + '/' + name);
copy('dist-pwa/artifact.json', destination + '/artifact.json');
const helpers = ['run-pwa-repair.mjs', 'run-pwa-repair.ps1', 'playwright.repair.config.mjs', 'preserve-pwa-repair.mjs'];
fs.mkdirSync(safe(destination + '/helpers', false));
for (const name of helpers) copy('.tmp/s03-offline-repair-20260908/' + name, destination + '/helpers/' + name);
const logs = [source + '/strict-artifact-audit.log', source + '/browser-run.log', '.tmp/s03-offline-repair-20260908/pipeline-a2.log'];
for (const original of logs.filter(exists)) {
  const raw = read(original), text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
  assert.deepEqual(Buffer.from(text, 'utf8'), raw);
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|"controlToken"\s*:/u.test(text), 'Secret-bearing transcript rejected');
  const target = destination + '/' + path.basename(original).replace(/\.log$/, '-log.json');
  save(target, { schemaVersion: 1, originalPath: original, originalBytes: raw.length, originalSha256: sha(raw),
    reconstruction: 'UTF-8 encode text exactly, without newline normalization', text });
  assert.deepEqual(Buffer.from(json(target).text, 'utf8'), raw);
  files.push({ source: original, path: target, bytes: read(target).length, sha256: sha(read(target)), rawBytes: raw.length, rawSha256: sha(raw), lossless: true });
}
const executions = [];
function collect(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      assert.equal(spec.title, 'device preparation restores real offline bytes and keeps simulated browser decisions truthful');
      const result = test.results?.at(-1);
      executions.push({ title: spec.title, project: test.projectName, expectedStatus: test.expectedStatus,
        status: result?.status ?? null, durationMs: result?.duration ?? null, errors: result?.errors ?? [], attachments: result?.attachments ?? [] });
    }
    collect(suite.suites ?? []);
  }
}
if (exists(source + '/results.json')) collect(json(source + '/results.json').suites ?? []);
fs.mkdirSync(safe(destination + '/screenshots', false));
fs.mkdirSync(safe(destination + '/device', false));
if (exists(source + '/artifacts')) walk(source + '/artifacts', relative => {
  // No traces, video, cookies, control files, account fixtures or signers.
  if (!/^(?:device-[a-z0-9-]+|test-failed-\d+)\.png$/.test(path.basename(relative))) return;
  const flattened = relative.replaceAll('/', '--');
  copy(source + '/artifacts/' + relative, destination + '/screenshots/' + flattened);
});
for (const execution of executions) for (const attachment of execution.attachments) {
  if (attachment.name !== 'device-preparation-evidence' || attachment.contentType !== 'application/json') continue;
  const target = destination + '/device/' + execution.project + '.json';
  if (attachment.path) {
    const absolute = path.resolve(root, attachment.path), relative = path.relative(root, absolute).replaceAll('\\', '/');
    assert.ok(relative.startsWith(source + '/artifacts/')); copy(relative, target);
  } else if (attachment.body) {
    const bytes = Buffer.from(attachment.body, 'base64'); JSON.parse(bytes);
    fs.writeFileSync(safe(target, false), bytes, { flag: 'wx' });
    files.push({ source: source + '/results.json#attachment/' + execution.project, path: target, bytes: bytes.length, sha256: sha(bytes) });
  }
}
let archivedRuntime = null;
if (run.strictArtifactAuditPassed) {
  const audit = json(source + '/strict-artifact-audit.json'); assert.equal(audit.pass, true); assert.equal(audit.identity.buildId, buildId);
  const expected = new Map(artifact.inventory.map(file => [file.path, file]));
  const original = [];
  walk('dist-pwa', relative => {
    const raw = read('dist-pwa/' + relative), file = { path: relative, bytes: raw.length, sha256: sha(raw) };
    if (relative !== 'artifact.json') assert.deepEqual(file, expected.get(relative)); original.push(file);
  });
  assert.equal(original.length, expected.size + 1); fs.mkdirSync(safe(archive, false));
  for (const file of original) {
    const parent = path.posix.dirname(file.path);
    if (parent !== '.') fs.mkdirSync(safe(archive + '/' + parent, false), { recursive: true });
    const raw = read('dist-pwa/' + file.path); fs.writeFileSync(safe(archive + '/' + file.path, false), raw, { flag: 'wx' });
    const copied = read(archive + '/' + file.path); assert.equal(copied.length, file.bytes); assert.equal(sha(copied), file.sha256);
  }
  archivedRuntime = { path: archive, files: original.length, bytes: original.reduce((sum, file) => sum + file.bytes, 0), artifactSha256: sha(artifactBytes), exactCopiesVerified: true };
  save(destination + '/artifact-copy-verification.json', { ...archivedRuntime, sourceCommit, buildId, inventory: original });
}
const result = { schemaVersion: 1, stage: 'S03', recordedAt: new Date().toISOString(), runId, sourceCommit, buildId,
  status: run.pass ? 'SELECTED_WORKING_VALIDATION_PASSED' : 'SELECTED_WORKING_VALIDATION_FAILED',
  strictArtifactAuditPassed: run.strictArtifactAuditPassed, statistics: run.statistics, sourceUnchanged: run.sourceUnchanged,
  executions, artifact: archivedRuntime, preservedFiles: files, stageAccepted: false, releaseReady: false,
  copyReviewStatus: 'draft', actualOsInstallation: false, realPaymentProviderConfigured: false,
  limits: ['Only the selected device scenario in two Chrome viewports; original errors are preserved.',
    'Actual app/worker/cache/network; installation and storage permission choices remain explicit browser fixtures.',
    'Cold reloads create new documents. Canvas identity is checked only across locale and repair within the existing document.'] };
save(destination + '/result.json', result);
console.log(JSON.stringify({ evidence: destination + '/result.json', status: result.status, statistics: run.statistics,
  artifact: archivedRuntime, testsRun: false, buildsRun: false, stageAccepted: false }));
