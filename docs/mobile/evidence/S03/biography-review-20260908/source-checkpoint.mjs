import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = 'docs/mobile', evidence = `${base}/evidence/S03/biography-review-20260908`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async name => JSON.parse((await fs.readFile(name, 'utf8')).replace(/^\uFEFF/u, ''));
const git = args => execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const copied = [];
async function preserve(from, to) {
  const bytes = await fs.readFile(from), destination = `${evidence}/${to}`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes, { flag: 'wx' });
  assert.ok(bytes.equals(await fs.readFile(destination)));
  copied.push({ source: from, path: to, bytes: bytes.length, sha256: sha(bytes) });
}
const paths = [
  ['.tmp/biography-review-20260908/hash-contract', 'hash-contract', ['run.json', 'vitest.json', 'stdout.log', 'stderr.log']],
  ['.tmp/s03-biography-review-20260908/runtime-unit-a1', 'history/runtime-unit-a1', ['result.json', 'vitest.json', 'source-before.json', 'source-after.json', 'stdout.log', 'stderr.log']],
  ['.tmp/s03-biography-review-20260908/runtime-unit-a2', 'runtime', ['result.json', 'vitest.json', 'source-before.json', 'source-after.json', 'stdout.log', 'stderr.log']],
  ['.tmp/s03-biography-review-20260908/public-unit-a1', 'history/public-startup-a1', ['stdout.log', 'stderr.log']],
  ['.tmp/s03-biography-review-20260908/public-unit-a2', 'public-export', ['result.json', 'vitest.json', 'stdout.log', 'stderr.log']],
  ['.tmp/s03-biography-review-20260908/joint-static', 'static', ['static-checks.json', 'typecheck.json', 'platform-boundaries.json']],
  ['.tmp/s03-biography-review-20260908/corpus-a1', 'corpus', ['result.json', 'source-before.json', 'source-after.json', 'baseline-metafile.json', 'current-metafile.json']],
];
const hashRun = await read(paths[0][0] + '/run.json'); assert.equal(hashRun.exitCode, 0); assert.deepEqual(hashRun.before, hashRun.after);
const runtime = await read(paths[2][0] + '/result.json'); assert.equal(runtime.exitCode, 0); assert.equal(runtime.inputsUnchanged, true);
const runtimeAfter = await read(paths[2][0] + '/source-after.json');
const publicRun = await read(paths[4][0] + '/result.json'); assert.equal(publicRun.exitCode, 0); assert.equal(publicRun.unchanged, true);
const checks = await read(paths[5][0] + '/static-checks.json'); assert.equal(checks.unchanged, true); assert.ok(checks.results.every(item => item.exitCode === 0));
for (const file of [...hashRun.after, ...publicRun.after, ...checks.after, ...Object.entries(runtimeAfter).map(([path, sha256]) => ({ path, sha256 }))]) {
  assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
}
const unitGroups = [];
for (const [source, label, expected] of [[paths[0][0], 'hash-contract', 50], [paths[2][0], 'runtime-and-CMS', 52], [paths[4][0], 'public-export', 36]]) {
  const report = await read(source + '/vitest.json'); assert.equal(report.numPassedTests, expected); assert.equal(report.numFailedTests, 0);
  unitGroups.push({ scope: label, passed: report.numPassedTests, failed: report.numFailedTests, files: report.testResults.length });
}
const corpus = await read(paths[6][0] + '/result.json');
assert.equal(corpus.success, true); assert.equal(corpus.inputsUnchanged, true);
assert.deepEqual(corpus.counts.currentNormalized, { ru: 1684, en: 20 });
assert.deepEqual(corpus.counts.currentNormalized, corpus.counts.baselineNormalized);
assert.equal(corpus.removed.length, 0); assert.equal(corpus.errors.length, 0);
const browser = await read(`${evidence}/browser/result.json`);
assert.equal(browser.sourceUnchanged, true); assert.equal(browser.statistics.expected, 1);
assert.equal(browser.statistics.unexpected, 0); assert.equal(browser.statistics.skipped, 0);
for (const file of browser.preservedFiles) assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
for (const [from, to, files] of paths) for (const name of files) await preserve(`${from}/${name}`, `${to}/${name}`);
const changed = [...new Set(git(['ls-files', '-z', '--modified', '--others', '--exclude-standard', '--', 'src', 'scripts', 'package.json', 'package-lock.json']).split('\0').filter(Boolean))].sort();
const sourceFiles = await Promise.all(changed.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const recordedAt = new Date().toISOString();
const result = { schemaVersion: 1, stage: 'S03', status: 'FOCUSED_SOURCE_VALIDATION_PASSED', recordedAt,
  sourceCheckpointBeforeChanges: git(['rev-parse', 'HEAD']).trim(), sourceFiles,
  scope: 'Shared bilingual biography draft/review/stale invariant in the active S03 route; not S38 acceptance.',
  requirementReferences: ['BIL-022', 'BIL-023', 'BIL-083', 'BIL-101'],
  tests: { passed: 138, failed: 0, groups: unitGroups, earlierRuntimePassesNotDoubleCounted: 34 },
  static: { typeScriptPassed: true, platformBoundariesPassed: true, executionsPerCheck: 1, evidence: 'static/static-checks.json' },
  implemented: ['Generated biography output stays draft and preserves existing EN correction work.',
    'Independent exact-revision review contract applies to human and machine translations in selector and public export.',
    'Source eligibility and recursive/cyclic dependency handling fail closed.',
    'CMS overrides reconcile stale revisions without auto-promotion; provenance survives export.'],
  dependency: { name: '@noble/hashes', version: '1.8.0', previouslyInstalledTransitiveVersion: true, rootProductionDependencyPinned: true, lockNormalizedOffline: true },
  automationCreatedRealApprovals: 0, realBiographiesTranslated: 0,
  browserEvidencePending: false, corpusExportComparisonPending: false,
  browser: { evidence: 'browser/result.json', sha256: sha(await fs.readFile(`${evidence}/browser/result.json`)), passed: 1, failed: 0, actualAppSource: true, nativePluginsSimulated: true, exactArtifactRuntime: false },
  visualReview: { files: ['browser/native-entry-en.png', 'browser/native-entry-ru.png'], observed: 'Actual globe and country/selected-writer breadcrumbs remain; English unavailable-content notices visible. This is not full EN content acceptance.' },
  corpus: { evidence: 'corpus/result.json', countries: 200, writers: 1684, beforeAndAfter: { ru: 1684, en: 20 }, removed: 0, proseChanged: 0, originalProvenanceRetained: 1672, translatedApprovals: 0, factualReviewPerformed: false },
  newNativeArtifactProduced: false, newPwaArtifactProduced: false,
  history: ['Runtime a1 passed before review found source-eligibility and correction-retention defects; corrected runtime/CMS/overlay a2 is the final 52-case run.',
    'Public a1 failed at sandboxed esbuild config loading with no Vitest report; public a2 ran all 36 selected tests successfully.',
    'Offline install with a package argument lacked cached registry metadata; the existing exact dependency was declared and npm normalized its lock offline without that argument.'],
  copiedFiles: copied,
  limitations: ['Review metadata is a trusted editorial attestation; hashes prove revision binding, not reviewer authentication or fact verification.',
    'No complete English biography/content coverage, owner correction UI, nearly10k capacity, edition-specific cover mapping, device or release acceptance.'],
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.writeFile(`${evidence}/result.json`, json(result), { flag: 'wx' });
const names = ['AUTOPILOT_STATE.json', 'STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md', 'DECISIONS.md'];
const before = new Map(await Promise.all(names.map(async name => [name, await fs.readFile(`${base}/${name}`, 'utf8')])));
const state = JSON.parse(before.get(names[0])), cache = state.verificationCache;
const protectedValue = () => JSON.stringify({ stages: state.stages.map(({ artifacts, ...rest }) => rest), head: state.headSha, ios: cache.s04IosGlobeProjection, firstJourney: cache.s05FirstJourney });
const protectedBefore = protectedValue(); assert.equal(state.currentCriterionId, 'S03.acceptance');
cache.s03BiographyReview = { evidence: `${evidence}/result.json`, sha256: sha(await fs.readFile(`${evidence}/result.json`)), status: result.status, unitPasses: 138,
  exactReviewContract: 'writer-biography-review-v1', actualApprovalsCreated: 0, sourceBrowserPasses: 1, corpusExportComparisonPassed: true, newNativeArtifactProduced: false, newPwaArtifactProduced: false, stageAccepted: false, releaseReady: false };
cache.s04GlobeApplication.nativeArtifactCurrentSource = false;
cache.s04GlobeApplication.nativeArtifact.currentSource = false;
cache.s04GlobeApplication.nativeArtifact.runtimeEquivalentToCurrentSource = false;
cache.s07AppearanceQuality.nativeRuntimeEquivalentToCurrentSource = false;
cache.s03OfflineRepair.currentSource = false;
state.stages.find(item => item.id === 'S03').artifacts.push(`${evidence}/result.json`);
state.updatedAt = recordedAt;
state.resume.nextAction = 'Build fresh Android/dev and controlled PWA from the committed biography review source, preserving prior17b6/7855 and frozen iOS83. Focused138, joint static, one real RU/EN writer/globe source-browser case and the full current biography exporter comparison passed. Do not repeat green appearance/repair suites. S03 remains first-open; full S38 editorial/owner correction workflow and English coverage, nearly10k capacity, edition covers, quality tiers and other device/release gates remain open.';
assert.equal(protectedValue(), protectedBefore);
const block = '<!-- s03-biography-review:begin -->\nCurrent work: exact editorial acceptance and stale propagation for biographies.\nGenerated EN stays draft; both human and machine translations require a supplied\nhuman review bound to exact source/target revisions and an eligible source.\nCMS edits invalidate acceptance; generated data preserves existing correction\nwork. The public exporter retains original and post-edit provenance.\n138 focused tests plus one shared TypeScript/platform-boundary execution passed.\nOne actual RU/EN writer/globe source-browser case passed with simulated native\nplugins. Corpus export retains all1684 RU/20 authored EN profiles and preserves\npreviously dropped provenance on1672 RU profiles; no prose changes.\nFresh Android/PWA artifacts follow this source checkpoint. Prior17b6/7855 below\nnow retain historical source identities. Evidence: evidence/S03/biography-review-20260908/result.json.\nNo real translation approval was created. Full English coverage, visual owner\ncorrections, nearly10k capacity, edition-specific covers and all open stage/device\nrelease gates remain incomplete; first-open is S03, full S38 is not started.\n<!-- s03-biography-review:end -->';
const after = new Map([['AUTOPILOT_STATE.json', json(state)]]);
for (const name of ['STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md']) {
  const content = before.get(name).replaceAll('\r\n', '\n'); assert.ok(!content.includes('<!-- s03-biography-review:begin -->'));
  const index = content.indexOf('\n\n'); assert.ok(index >= 0);
  after.set(name, content.slice(0, index + 2) + block + '\n\n' + content.slice(index + 2));
}
const decisions = before.get('DECISIONS.md').replaceAll('\r\n', '\n').replace(/^\+  /gmu, '  ');
assert.ok(!/^- D086:/mu.test(decisions));
after.set('DECISIONS.md', decisions.trimEnd() + '\n\n- D086: Generated biographies are drafts; model checks/post-edit metadata cannot\n  manufacture human acceptance. Both translation methods require a separately\n  supplied review bound to exact source/target revisions and an eligible source.\n  Run stale reconciliation after CMS edits and preserve existing draft/stale\n  correction work. Keep historical sourceHash formats; use a separate versioned\n  browser/Node SHA256 review contract. Hash validity does not authenticate the\n  supplied reviewer or establish factual accuracy. This is a bounded S03 global\n  invariant correction, not S38 workflow/English coverage acceptance.\n');
for (const name of names) assert.equal(await fs.readFile(`${base}/${name}`, 'utf8'), before.get(name));
for (const [name, content] of after) await fs.writeFile(`${base}/${name}`, content);
console.log(json({ evidence: `${evidence}/result.json`, focusedTests: 138, typeScript: true, boundaries: true, stageAccepted: false, releaseReady: false }));
