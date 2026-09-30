import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const base = path.dirname(fileURLToPath(import.meta.url));
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const real = fs.realpathSync(root);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ref = p => ({ path: p.replaceAll('\\', '/'), sha256: hash(p) });
const write = (name, data) => { const p = path.join(base, name); assert(!fs.existsSync(p)); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); return ref(p); };
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', `safe.directory=${real}`, ...args], { cwd: root, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, maxBuffer: 64 * 1024 * 1024 });
const textgit = (...args) => git(...args).toString('utf8').trim();
assert.equal(hash(path.join(base, 'entry.json')), '796dfaa21fb451705669cdc15a191b2a25e92ab2840370b3af7c8d41e83fd56c');
const entry = read(path.join(base, 'entry.json'));
assert.equal(hash(entry.sourceManifest.path), entry.sourceManifest.sha256);
const manifest = read(entry.sourceManifest.path);
const assertSources = () => { for (const f of manifest.files) assert.equal(hash(path.join(root, f.path)), f.sha256, f.path); };
assertSources();
assert.equal(manifest.files.length, 1665);
assert.equal(textgit('rev-parse', 'HEAD'), entry.checkpoint);
assert.equal(textgit('diff', '--cached', '--name-only'), '');
assert.deepEqual(textgit('diff', '--name-only').split('\n').sort(), [...entry.changedPaths].sort());
assert.equal(textgit('ls-files', '--others', '--exclude-standard'), '');
const browserPath = path.join(base, 'result.json');
assert.equal(hash(browserPath), 'ad064d97b411805e04e048d0433ca8a70d146735bc403edd15619c3287a0392d');
const browser = read(browserPath);
assert.equal(browser.pass, true);
assert.deepEqual(browser.tests, { passed: 1, failed: 0, skipped: 0, flaky: 0 });
assert.equal(hash(browser.evidence.path), browser.evidence.sha256);
const evidence = read(browser.evidence.path);
const recovery = evidence.observations.restoredDeliveryExplicitRestart;
assert.equal(evidence.restoredDeliveryExplicitRestartVerified, true);
assert.equal(recovery.phase, 'actual-ready-after-explicit-restart');
assert.equal(recovery.beforeRestoration.timeOrigin, recovery.afterRestorationWithoutAction.timeOrigin);
assert.equal(recovery.beforeRestoration.href, recovery.afterRestorationWithoutAction.href);
assert.notEqual(recovery.beforeRestoration.timeOrigin, recovery.afterRestart.timeOrigin);
assert.equal(recovery.afterRestart.href, recovery.beforeRestoration.href);
assert.equal(recovery.afterRecovery.detailStatus, 'ready');
for (const state of ['beforeRestoration', 'afterRestorationWithoutAction', 'afterRestart', 'afterRecovery']) {
  assert.equal(recovery[state].globe.surfaceCount, 1);
  assert.equal(recovery[state].globe.sameScene, true);
}
assert.equal(recovery.beforeRestoration.globe.geometry, recovery.afterRestorationWithoutAction.globe.geometry);
assert.equal(recovery.afterRestart.globe.geometry, recovery.afterRecovery.globe.geometry);
assert.deepEqual(recovery.beforeRestoration.globe.selection, recovery.afterRestart.globe.selection);
const trustedRestart = recovery.retainedInputEvents.filter(e => e.bookyRestart === 'books');
assert.deepEqual(trustedRestart.map(e => e.type), ['pointerdown', 'pointerup', 'click']);
assert(trustedRestart.every(e => e.trusted && e.pointerType === 'touch'));
assert(recovery.restartTap.bounds.height >= 43.5);
const responses = evidence.bookDeliveryEvents.filter(e => e.kind === 'response');
assert.deepEqual(responses.map(r => r.status), [503, 503, 200]);
assert.equal(responses[2].path, evidence.primaryBookChunk);
assert.equal(responses[2].sha256, recovery.availableBytes.find(b => b.path === evidence.primaryBookChunk).sha256);
for (const key of ['bookyWrites', 'customizationWrites', 'unexpectedPreferenceWrites', 'errors', 'externalRequests', 'missingResources']) assert.deepEqual(evidence[key], [], key);
assert.equal(evidence.originalExhaustionSegmentNoSuccessfulCollectionClaim, true);
assert.equal(evidence.noSuccessfulCollectionClaim, false);
const causalReview = write('root-causal-review.json', {
  schemaVersion: 1, pass: true, browserResult: ref(browserPath), evidence: browser.evidence,
  originalTwo503AndExplicitReturnRetained: true,
  restoredBytesDoNotAutomaticallyRetryOrReload: true,
  actualTrustedRestartInputs: trustedRestart,
  originalPrimary200RestoredBytes: responses[2],
  canonicalSceneRetainedBeforeExplicitRestart: true,
  canonicalSceneCountOneWithinEachDocument: true,
  oldSceneIdentityPreservedAcrossRestartClaimed: false,
  bookyAndAppearanceWrites: 0,
  otherPreferenceOperations: 'Ordinary recent writer history records one write; no zero-total-preference-write claim.',
  actualReadyAfterExplicitRestartAndReopen: true,
  scope: 'One RU 320x844 actual App case in Edge, controlled transport/native ports; not installed-device or stage acceptance.',
  stageAccepted: false, releaseReady: false
});
assert.equal(browser.captures.length, 1);
for (const capture of browser.captures) assert.equal(hash(capture.path), capture.sha256);
const visualReview = write('root-visual-review.json', {
  schemaVersion: 1, pass: true, captures: browser.captures, reviewer: 'root',
  directViewCompleted: true,
  observations: ['The 320x844 actual failure capture shows an aligned reserved Booky header; avatar, title and close do not overlap.', 'The collection failure message states explicit restart or return. The help body scrolls; actions below the initial crop are not claimed visible in this image.', 'The actual browser evidence separately proves the 44px restart action is scrolled into view and receives trusted touch.'],
  allStatesVisuallyAccepted: false, installedDeviceAccepted: false, stageAccepted: false, releaseReady: false
});
const checksPath = path.join(base, 'checks-result.json');
assert.equal(hash(checksPath), '437023983541c95eb8a08a1fd6ea046b9bbedeb94941da335fe014a36f843453');
assert.equal(read(checksPath).pass, true);
git('add', '--', ...entry.changedPaths);
assert.deepEqual(textgit('diff', '--cached', '--name-only').split('\n').sort(), [...entry.changedPaths].sort());
const commitOutput = textgit('commit', '-m', 'Restore collection after exhausted module retry with explicit restart');
const commit = textgit('rev-parse', 'HEAD');
assert.equal(textgit('rev-parse', `${commit}^`), entry.checkpoint);
assert.deepEqual(textgit('diff-tree', '--no-commit-id', '--name-only', '-r', commit).split('\n').sort(), [...entry.changedPaths].sort());
const blobs = entry.changedPaths.map(p => {
  const working = fs.readFileSync(path.join(root, p));
  const blob = git('cat-file', 'blob', `${commit}:${p}`);
  assert.equal(blob.toString('utf8').replaceAll('\r\n', '\n'), working.toString('utf8').replaceAll('\r\n', '\n'), p);
  return { path: p, workingSha256: hash(path.join(root, p)), gitBlobSha256: crypto.createHash('sha256').update(blob).digest('hex'), onlyLineEndingNormalization: !working.equals(blob) };
});
assertSources();
assert.equal(textgit('status', '--porcelain'), '');
const result = write('actual-source-commit.json', {
  schemaVersion: 1, pass: true, recordedAt: new Date().toISOString(), sourceCommit: commit,
  predecessorDocsCommit: entry.checkpoint, changedPaths: entry.changedPaths,
  sourceManifest: entry.sourceManifest, sourceInputCount: 1665, protectedInputCount: 1653,
  entry: ref(path.join(base, 'entry.json')), sourceApply: entry.sourceApply,
  checksResult: ref(checksPath), browserResult: ref(browserPath), causalReview, rootReview: visualReview,
  blobs, sourceInputsUnchanged: true, sourceInputsVerifiedBeforeAfter: true, worktreeClean: true,
  productionImplemented: true, runtimeUnchanged: false, fixtureOnly: false,
  testsRerun: false, buildsRun: false, stageAccepted: false, releaseReady: false, commitOutput,
  producer: ref(fileURLToPath(import.meta.url))
});
console.log(JSON.stringify({ sourceCommit: commit, result, causalReview, visualReview }));
