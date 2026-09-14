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
const [sourceCommit, buildId] = [args[1], args[3]], runId = 'pwa-archive-search-20260914-a1';
const source = '.tmp/pwa-cross-engine-results/' + runId;
const destination = 'docs/mobile/evidence/S10/opposite-locale-search-20260914/pwa';
const archive = `.tmp/pwa-artifacts/${buildId.slice(0, 8)}-archive-search-20260914-a1`;
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
const recoveredWrites = [];
function writeVerified(filename, value, options) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  if (!fs.existsSync(filename)) { fs.writeFileSync(filename, bytes, options); return; }
  assert.equal(fs.realpathSync(filename), filename); assert.equal(fs.lstatSync(filename).isSymbolicLink(), false);
  const existing = fs.readFileSync(filename); if (existing.equals(bytes)) return;
  const archiveRoot = safe(archive) + path.sep;
  assert.ok(filename.startsWith(archiveRoot), 'Only the interrupted runtime archive may contain a partial write');
  assert.ok(existing.length < bytes.length && existing.equals(bytes.subarray(0, existing.length)), 'Existing bytes must be an exact short prefix from interrupted ENOSPC copy');
  recoveredWrites.push({path:path.relative(root, filename).replaceAll('\\','/'),previousBytes:existing.length,expectedBytes:bytes.length,previousSha256:sha(existing),expectedSha256:sha(bytes)});
  fs.writeFileSync(filename, bytes, {flag:'w'});
}
function save(filename, value) { writeVerified(safe(filename, false), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
const run = json(source + '/run-result.json'), session = json(source + '/session.json');
assert.equal(run.runId, runId); assert.equal(run.sourceCommit, sourceCommit); assert.equal(run.buildId, buildId);
assert.equal(run.stageAccepted, false); assert.equal(run.releaseReady, false);
assert.equal(session.artifact.buildId, buildId); assert.equal(session.artifact.sourceCommit, sourceCommit);
assert.equal(exists(destination), true); assert.equal(exists(archive), true); assert.equal(exists(destination + "/result.json"), false);
const artifactBytes = read('dist-pwa/artifact.json'), artifact = JSON.parse(artifactBytes);
assert.equal(artifact.buildId, buildId); assert.equal(artifact.sourceCommit, sourceCommit);
assert.equal(artifact.localQaAuthority, true); assert.equal(artifact.releaseReady, false);
const files = [];
function copy(original, target) {
  const bytes = read(original); writeVerified(safe(target, false), bytes, { flag: 'wx' }); assert.deepEqual(read(target), bytes);
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
safe(path.posix.dirname(destination));
if (!exists(destination)) fs.mkdirSync(safe(destination, false));
const reports = ['session.json', 'source-before.json', 'source-after.json', 'source-comparison.json',
  'support-before.json', 'support-after.json', 'strict-artifact-audit.json', 'strict-artifact-audit-execution.json',
  'server-closed.json', 'run-result.json', 'discovery.json', 'discovery-execution.json', 'browser-run-execution.json', 'results.json'];
for (const name of reports) if (exists(source + '/' + name)) copy(source + '/' + name, destination + '/' + name);
copy('dist-pwa/artifact.json', destination + '/artifact.json');
copy('.tmp/s10-opposite-locale-search-20260914/prior-pwa.json', destination + '/prior-pwa.json');
for (const name of ['preparation.json', 'preparation-recovery.json', 'pipeline-a1-execution.json']) {
  const original = '.tmp/s10-opposite-locale-search-20260914/' + name;
  if (exists(original)) copy(original, destination + '/' + name);
}
const helpers = ['run-pwa.mjs', 'preserve-pwa.mjs', 'park-prior-pwa.mjs', 'playwright.archive-search.config.mjs'];
if (!exists(destination + '/helpers')) fs.mkdirSync(safe(destination + '/helpers', false));
for (const name of helpers) copy('.tmp/s10-opposite-locale-search-20260914/' + name, destination + '/helpers/' + name);
const logs = ['strict-artifact-audit', 'discovery', 'browser-run'].flatMap(name => ['.log', '.stdout.log', '.stderr.log'].map(suffix => source + '/' + name + suffix)).concat('.tmp/s10-opposite-locale-search-20260914/pipeline-a1.log');
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
assert.ok([0, 1].includes(run.browserExecutions));
const browserProof = [];
if (exists(source + '/results.json')) {
  const collect = suites => { for (const suite of suites) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      assert.equal(spec.title, 'offline PWA cross-language author search and book return retain the globe and integrated archive card');
      assert.equal(test.projectName, 'pwa-desktop');
      const result = test.results.at(-1);
      browserProof.push({ title: spec.title, project: test.projectName, status: result.status, durationMs: result.duration, errors: result.errors ?? [] });
      for (const attachment of result.attachments || []) {
        if (!attachment.name.startsWith('pwa-country-writer-')) continue;
        if (attachment.contentType === 'application/json' && attachment.body) writeVerified(safe(destination + '/' + attachment.name + '.json', false), Buffer.from(attachment.body, 'base64'), {flag:'wx'});
        if (attachment.contentType === 'image/png' && attachment.body) {
          const raw=Buffer.from(attachment.body,'base64'), destinationPath=destination+'/'+attachment.name+'.png';
          writeVerified(safe(destinationPath,false),raw,{flag:'wx'});
          files.push({source:'exact Playwright attachment body',path:destinationPath,bytes:raw.length,sha256:sha(raw)});
        } else if (attachment.contentType === 'image/png' && attachment.path) {
          const relative = path.relative(root, path.resolve(root, attachment.path)).replaceAll('\\', '/');
          assert.ok(relative.startsWith(source + '/')); copy(relative, destination + '/' + attachment.name + '.png');
        }
      }
    }
    collect(suite.suites ?? []);
  } };
  collect(json(source + '/results.json').suites ?? []);
  assert.equal(browserProof.length, 1);

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
  assert.equal(original.length, expected.size + 1); if (!exists(archive)) fs.mkdirSync(safe(archive, false));
  for (const file of original) {
    const parent = path.posix.dirname(file.path);
    if (parent !== '.') fs.mkdirSync(safe(archive + '/' + parent, false), { recursive: true });
    const raw = read('dist-pwa/' + file.path); writeVerified(safe(archive + '/' + file.path, false), raw, { flag: 'wx' });
    const copied = read(archive + '/' + file.path); assert.equal(copied.length, file.bytes); assert.equal(sha(copied), file.sha256);
  }
  const wanted = new Set(original.map(file => file.path));
  let archivedCount = 0; walk(archive, relative => { assert.ok(wanted.has(relative), 'Unexpected interrupted archive entry'); archivedCount++; });
  assert.equal(archivedCount, original.length);
  archivedRuntime = { path: archive, files: original.length, bytes: original.reduce((sum, file) => sum + file.bytes, 0), artifactSha256: sha(artifactBytes), exactCopiesVerified: true };
  save(destination + '/artifact-copy-verification.json', { ...archivedRuntime, sourceCommit, buildId, inventory: original });
}
const result = { schemaVersion: 1, stage: 'S10', recordedAt: new Date().toISOString(), runId, sourceCommit, buildId,
  status: run.pass ? 'LOCAL_QA_PWA_BUILD_AUDIT_AND_AFFECTED_BROWSER_PASSED' : 'LOCAL_QA_PWA_BUILD_AUDIT_AND_AFFECTED_BROWSER_FAILED',
  strictArtifactAuditPassed: run.strictArtifactAuditPassed, statistics: run.statistics, sourceUnchanged: run.sourceUnchanged,
  browserTestsRun: run.browserTestsRun, browserExecutions: run.browserExecutions, browserProof, artifact: archivedRuntime, preservedFiles: files, stageAccepted: false, releaseReady: false,
  copyReviewStatus: 'draft', actualOsInstallation: false, realPaymentProviderConfigured: false,
  limits: ['Fresh local QA Vite/worker build, strict audit, exact archive and one built PWA cross-language author search, integrated archive-card navigation and offline locale case.',
    'Success screenshots are exact local-QA artifact captures, not store RC or installed native OS evidence.',
    'Local ephemeral QA authority does not establish a real merchant/payment, legal/editorial approval, owner acceptance or release readiness.'] };
save(destination + '/preservation-recovery.json', {schemaVersion:1,recordedAt:new Date().toISOString(),reason:'ENOSPC during extra runtime copy; completed source build/audit/browser were not repeated',recoveredWrites,generatedIntermediatesRemovedBytes:150308463,finalApksRetained:true,buildsRepeated:false,testsRepeated:false});
save(destination + '/result.json', result);
console.log(JSON.stringify({ evidence: destination + '/result.json', status: result.status, statistics: run.statistics,
  artifact: archivedRuntime, preservationOnly: true, additionalTestsRun: false, additionalBuildsRun: false, stageAccepted: false }));
