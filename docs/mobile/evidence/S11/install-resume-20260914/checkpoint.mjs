import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const root = await fs.realpath('.'), base = 'docs/mobile', out = base + '/evidence/S11/install-resume-20260914';
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const [unitAttempt, browserAttempt] = process.argv.slice(2); for (const value of [unitAttempt, browserAttempt]) assert.match(value, /^a[1-9][0-9]*$/u);
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/u, ''));
const head = execFileSync('git', ['-c', 'safe.directory=' + root.replaceAll('\\', '/'), 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head, '32dad95fde9aba390a5b15501f3aed07767b0fd3');
const entry = await read(out + '/entry.json'); assert.equal(entry.checkpoint, head);
const unitPath = out + '/unit-' + unitAttempt + '/result.json', browserPath = out + '/browser-' + browserAttempt + '/result.json';
const unit = await read(unitPath), browser = await read(browserPath);
const recovery = await read(browser.recovery);
assert.equal(recovery.additionalTestRuns, 0);
const originalRunner = await fs.readFile(recovery.runner.testedOriginal, 'utf8');
assert.equal(sha(originalRunner), recovery.runner.beforeSha256);
const expectedRunner = originalRunner.replace("import fs from 'node:fs/promises';", "import fs from 'node:fs/promises';\nimport path from 'node:path';")
  .replace('S11_BROWSER_REPORT: reportPath', 'S11_BROWSER_REPORT: path.resolve(reportPath)');
assert.equal(await fs.readFile(recovery.runner.path, 'utf8'), expectedRunner);
assert.equal(sha(expectedRunner), recovery.runner.afterSha256);
for (const result of [unit, browser]) {
  assert.equal(result.pass, true); assert.equal(result.unchanged, true); assert.equal(result.head, head);
  assert.deepEqual(result.before, result.after);
  for (const input of result.after) assert.equal(input.path === recovery.runner.path ? sha(originalRunner) : sha(await fs.readFile(input.path)), input.sha256, input.path);
}
assert.deepEqual(unit.after, browser.after); assert.equal(unit.tests.files, 1);
assert.equal(browser.tests.passed, 1); assert.equal(browser.tests.failed, 0); assert.equal(browser.tests.skipped, 0); assert.equal(browser.tests.flaky, 0);
const proofBytes = await fs.readFile(browser.proof.path); assert.equal(proofBytes.length, browser.proof.bytes); assert.equal(sha(proofBytes), browser.proof.sha256);
const browserProof = JSON.parse(proofBytes); assert.deepEqual(browserProof.offlineLocales, ['ru', 'en']);
assert.deepEqual(browserProof.finalCounts, { '/planet/assets/app.js': 1, '/planet/en/': 2, '/planet/ru/': 1, '/planet/textures/fixture.webp': 2 });
assert.equal(browserProof.partial.complete, false); assert.equal(browserProof.partial.active, false); assert.equal(browserProof.partial.controlled, false);
assert.equal(browserProof.final.state, 'COMPLETE'); assert.equal(browserProof.final.activationSequence, 1);
const recordedAt = new Date().toISOString();
const sourceInputs = unit.after.filter(input => !input.path.startsWith('.tmp/'));
const next = 'Continue S11 with bounded signed content-package consumption/storage on the S08 canonical export contract; retain public PWA bootstrap recovery as a distinct tested layer. No owner archive population. Batch the next full PWA artifact refresh with the next affected runtime slice; existing PWA0381b95f includes the requested integrated card/search but predates install-resume. Android048c8e1b and frozen iOS83 stay preserved. Owner final canonical archive synchronization follows app implementation (D107).';
const result = {
  schemaVersion: 1, recordedAt, stage: 'S11', status: 'SOURCE_UNIT_AND_REAL_BROWSER_VALIDATION_PASSED',
  sourceBaseCommit: head, entry: out + '/entry.json', requirementIds: ['CONTENT-008'],
  implementation: ['src/pwa/serviceWorkerRuntime.js'], tests: ['src/pwa/serviceWorkerRuntime.test.mjs', 'tests/pwa/install-resume.spec.mjs'],
  sourceInputs, sourceInputsSha256: sha(json(sourceInputs)),
  validation: { unit: unitPath, passingUnitCases: unit.tests.passed, browser: browserPath, actualChromeCases: 1, browserProof: browser.proof,
    reportRecovery: browser.recovery, testHarnessOnlyCorrection: recovery.runner.correction, additionalRunsForReportRecovery: 0 },
  behavior: ['Interrupted first installation retains complete exact-hash files under a manifest-bound candidate.',
    'Retry verifies cached files before reuse; damaged or missing files are fetched again, and all files are reverified before COMPLETE.',
    'A new build removes obsolete recognized incomplete candidates, preserving completed, damaged-complete and unrelated caches.',
    'Candidate content cannot be served or activated; completed current/previous builds retain their existing protections.',
    'Same-worker concurrent install calls share one in-flight operation; the fixed-scope browser job queue serializes registrations. Candidate metadata is not a cross-context storage lock.'],
  officialReference: { url: 'https://w3c.github.io/ServiceWorker/#schedule-job-algorithm', checkedDate: '2026-09-14',
    scope: 'Current W3C editor draft Schedule/Run/Finish Job and Install failure lifecycle, confirmed by the actual Chrome retry scenario.' },
  limits: ['Whole-file retry, not byte-range downloads or a promise against browser storage eviction.',
    'Public PWA bootstrap only; signed locale/audio/child downloadable packages and native downloads remain open.',
    'Actual browser tested the bundled current worker with small transport fixtures; no full app build or RC claim.'],
  fullApplicationBuildRepeated: false, canonicalFactsChanged: false, ownerWorkflow: 'D107',
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false, next,
};
await assert.rejects(fs.stat(out + '/result.json'), { code: 'ENOENT' });
const state = await read(base + '/AUTOPILOT_STATE.json');
const protect = value => json({ head: value.headSha, firstOpen: value.currentCriterionId, current: value.currentStageId,
  ios: value.verificationCache.s04IosGlobeProjection, owner: value.verificationCache.ownerCatalogWorkflow,
  otherStages: value.stages.filter(stage => stage.id !== 'S11') });
const protectedState = protect(state); assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(stage => stage.id === 'S11'); assert.equal(stage.status, 'NOT_STARTED');
const criterion = stage.criteria.find(criterion => criterion.id === 'S11.CONTENT-008'); assert.equal(criterion.status, 'OPEN');
stage.status = 'IN_PROGRESS'; criterion.status = 'IN_PROGRESS';
criterion.notes += ' Public PWA first-install whole-file retry is implemented and tested. Full all-platform package/download recovery is not accepted.';
criterion.evidence = [...new Set([...criterion.evidence, out + '/result.json'])];
stage.artifacts = [...new Set([...stage.artifacts, out + '/entry.json', out + '/result.json'])];
stage.lastGreenCommands = ['node .tmp/s11-install-resume-20260914/run-checks.mjs unit ' + unitAttempt,
  'node .tmp/s11-install-resume-20260914/run-checks.mjs browser ' + browserAttempt];
state.verificationCache.parallelSafeStages.S11 = { reason: entry.basis, evidence: [out + '/entry.json'] };
state.verificationCache.s11InstallResume = { status: result.status, evidence: out + '/result.json', sha256: sha(json(result)),
  sourceBaseCommit: head, sourceInputsSha256: result.sourceInputsSha256, passingUnitCases: unit.tests.passed, actualChromeCases: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s10OppositeLocaleSearch.sourceInputsCurrent = false;
state.verificationCache.s10OppositeLocaleSearch.subsequentSourceChange = 'S11 public PWA install-resume, outside the completed card/search behavior; saved artifacts retain their exact original source proof.';
state.updatedAt = recordedAt; state.resume.nextAction = next + ' First-open S03 remains unchanged.';
state.resume.contextFiles = [...new Set([...state.resume.contextFiles, out + '/entry.json', out + '/result.json'])];
assert.equal(protect(state), protectedState);
const marker = 's11-install-resume-20260914';
const block = '<!-- ' + marker + ':begin -->\nS11 entered in a documented parallel-safe scope for CONTENT-008.\nPublic PWA first-install recovery reuses only whole verified candidate files.\n' + unit.tests.passed + ' worker unit cases and1 actual Chrome SW retry scenario passed:\nnew page after interruption, corrupted EN refetched, intact RU/app reused, then RUEN offline.\nCurrent/previous COMPLETE and child/access boundaries stay intact; candidate is not ready.\nNo full app/native build repeated for this PWA-only change. Prior PWA0381b95f includes\nthe requested integrated archive card/search but predates this retry implementation.\nEvidence: evidence/S11/install-resume-20260914/result.json.\nNext: signed content-package consumer/storage on S08 export; final owner archive sync after\napp implementation (D107). First-open S03; S11 and all release gates remain unaccepted.\n<!-- ' + marker + ':end -->\n\n';
const docs = [];
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = base + '/' + name, text = await fs.readFile(file, 'utf8'); assert.ok(!text.includes('<!-- ' + marker + ':begin -->'));
  docs.push([file, block + text]);
}
const decisionsPath = base + '/DECISIONS.md', decisions = await fs.readFile(decisionsPath, 'utf8');
assert.ok(!/^- D113:/mu.test(decisions));
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(base + '/AUTOPILOT_STATE.json', json(state));
for (const [file, text] of docs) await fs.writeFile(file, text);
await fs.writeFile(decisionsPath, decisions.trimEnd() + '\n\n- D113: Enter S11 in the documented parallel-safe CONTENT-008 scope. Resume\n  interrupted public PWA base installs from whole hash-verified files, bound to\n  the normalized manifest; keep COMPLETE serving/activation atomic and preserve\n  prior completed generations. Candidate metadata does not claim a cross-global\n  lock. One worker unit suite and actual Chrome registration retry validate this\n  source slice. Existing0381b95f PWA predates this worker change; batch a future\n  full PWA build after further S11 integration. Native/card/search artifacts stay\n  preserved. No child/content/native/offline stage acceptance, no content filling;\n  D107 final owner archive synchronization remains after app implementation.\n');
for (const name of ['run-checks.mjs', 'playwright.config.mjs', 'checkpoint.mjs', 'recover-browser-report.mjs']) await fs.copyFile('.tmp/s11-install-resume-20260914/' + name, out + '/' + name, fs.constants.COPYFILE_EXCL);
const verification = await verifyExecutionFiles(root);
await fs.writeFile(out + '/state-verification.json', json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, json(verification.errors));
console.log(json({ status: result.status, unitCases: unit.tests.passed, browserCases: 1, firstOpen: state.currentCriterionId,
  stages: Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(stage => stage.status === status).length])), stateVerification: true, releaseReady: false }));
