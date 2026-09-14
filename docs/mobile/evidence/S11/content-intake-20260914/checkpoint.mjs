import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const base = 'docs/mobile', out = base + '/evidence/S11/content-intake-20260914';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const head = execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head, '521417dd5ffb793b1a91fc3d09bb1d154193b5dd');
const reports = ['unit-a2', 'static-a2', 'browser-a3'];
const results = await Promise.all(reports.map(name => read(out + '/' + name + '/result.json')));
for (const result of results) {
  assert.equal(result.pass, true); assert.equal(result.unchanged, true); assert.equal(result.head, head);
  assert.deepEqual(result.before, result.after);
  for (const input of result.after) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
}
const [unit, checks, browser] = results;
assert.equal(unit.tests.passed, 126); assert.equal(unit.tests.files, 4);
assert.equal(checks.executions.length, 2); assert.ok(checks.executions.every(check => check.exitCode === 0));
assert.equal(browser.tests.passed, 1); assert.equal(browser.tests.flaky, 0);
const proofBytes = await fs.readFile(browser.proof.path); assert.equal(proofBytes.length, browser.proof.bytes); assert.equal(sha(proofBytes), browser.proof.sha256);
const proof = JSON.parse(proofBytes);
assert.equal(proof.pass, true); assert.equal(proof.browserRestarted, true); assert.equal(proof.offlineReadNetworkRequests, 0);
assert.deepEqual(proof.offlineLocales, ['ru', 'en']);
assert.equal(proof.steps.interrupted.ok, false); assert.equal(proof.steps.partialRead.ok, false); assert.equal(proof.steps.corruptionDenied.ok, false);
assert.equal(proof.steps.concurrentRetry.length, 2); assert.ok(proof.steps.concurrentRetry.every(result => result.ok && !result.activationAllowed));
for (const name of ['currentAfterBrowserRestartOffline', 'previousAfterBrowserRestartOffline', 'previousAfterCorruption']) {
  assert.equal(proof.steps[name].ok, true); assert.equal(proof.steps[name].activationAllowed, false);
}
for (const source of proof.sourceExports) {
  assert.equal(sha(await fs.readFile(source.inspection.path)), source.inspection.sha256);
  for (const file of source.checked) { const bytes = await fs.readFile(file.path); assert.equal(bytes.length, file.bytes); assert.equal(sha(bytes), file.sha256); }
}
const recordedAt = new Date().toISOString();
const entry = { schemaVersion: 1, recordedAt, stage: 'S11', checkpoint: head, route: 'S11-S15',
  precedingEntry: 'docs/mobile/evidence/S11/install-resume-20260914/entry.json', requirementIds: ['CONTENT-005', 'CONTENT-006'],
  basis: 'Extend the documented parallel-safe S11 scope over the preserved S08 signed candidate protocol. Integrity and derived local storage are independent of unresolved editorial, child, purchase and device release gates. Matrix69 permits documented parallel-safe entry.',
  inputReused: 'The immutable V12 intake and S11-S15 routed documents were read at this S11 entry; no unneeded stage documents loaded.',
  scope: ['Shared data-only signature protocol and WebCrypto verification with separately pinned dedicated public content keys.',
    'Derived QA byte cache with Web Locks, full RUEN readback, atomic selection and retained previous generation; no new catalog authority.',
    'Actual Chrome imports the two preserved S08 exports, without new archive filling or regenerated signing keys.'],
  acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
const inputs = unit.after.filter(input => !input.path.startsWith('.tmp/'));
const next = 'Continue S11 with bounded cancellable signed-package download transport and recovery wired to these verified cache contracts; integrate capabilities through the existing platform boundaries. Keep QA candidates outside production content activation. Batch full application artifacts only after an affected runtime integration. D107 final owner archive synchronization follows application implementation; no factual archive population.';
const result = { schemaVersion: 1, recordedAt, stage: 'S11', status: 'SOURCE_UNIT_AND_REAL_BROWSER_VALIDATION_PASSED', sourceBaseCommit: head,
  entry: out + '/entry.json', requirementIds: entry.requirementIds, sourceInputs: inputs, sourceInputsSha256: sha(json(inputs)),
  implementation: ['src/planet/contentPackageProtocol.mjs', 'src/planet/verifyContentPackage.ts', 'src/planet/contentPackageCache.ts', 'scripts/mobile/content-package-signature.mjs'],
  tests: ['scripts/mobile/content-package-signature.test.mjs', 'scripts/mobile/content-export-input.test.mjs', 'src/planet/verifyContentPackage.test.mjs', 'src/planet/contentPackageCache.test.mjs', 'tests/pwa/content-package-cache.spec.mjs'],
  validation: { reports: reports.map(name => out + '/' + name + '/result.json'), passingUnitCases: 126, unitFiles: 4, typecheck: true, platformBoundaries: true, actualChromeCases: 1, browserProof: browser.proof,
    failedAttemptsPreserved: ['unit-a1/result.json', 'static-a1/result.json', 'browser-a1/result.json', 'browser-a2/result.json'],
    corrections: ['Preserve the established exact-reader-context-required error for missing caller context.',
      'Use a declared never-returning function so TypeScript correctly narrows unavailable crypto/key branches.',
      'Chrome failed to open CacheStorage under the initial long Windows profile path. A shorter profile on the writable D volume passed, including persistent browser restart. No runtime integrity check was bypassed.'],
    browserProfileScope: 'Dedicated persistent QA profile, never the user browser profile; the application loader and script are supplied before network is disabled, then all package reads run offline.' },
  behavior: ['Node export signer and application verifier share the bounded data-only canonical JSON protocol; Node private-key operations stay outside the application bundle.',
    'Exact separately supplied package identity, source, version, reader compatibility and child policy plus pinned dedicated public keys are required; raw transport cannot establish its own trust.',
    'Both locale files and the dependency index are verified, saved and read back before one selection write; interrupted or corrupt candidates are never selected.',
    'Cooperating documents serialize with Web Locks and compare the previous receipt; a successful repeated import avoids rewriting intact files.',
    'Current and previous generations survive browser restart and are verified on every read; corruption refuses the affected generation while the previous exact receipt remains readable.',
    'All receipts remain local-qa, activationAllowed=false and releaseReady=false; no purchase, editorial or child approval is created.'],
  limits: ['Derived best-effort CacheStorage, not an authoritative second catalog or a promise against OS eviction.',
    'Current slice accepts provided bytes; network transport, download UI, native storage and integrated package application remain open.',
    'Previous-generation reads are explicit. No unverified automatic content rollback or activation policy is supplied.',
    'The dedicated module browser harness is not a whole-application, installed-device or exact-RC screenshot test.'],
  reference: { url: 'https://www.w3.org/TR/web-locks/', scope: 'Exclusive cross-document coordination while the returned operation promise is pending; active cache writes are awaited before releasing the lock.' },
  fullApplicationBuildRepeated: false, canonicalFactsChanged: false, editorialApprovalCreated: false, ownerWorkflow: 'D107',
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false, next };
await assert.rejects(fs.stat(out + '/result.json'), { code: 'ENOENT' });
const state = await read(base + '/AUTOPILOT_STATE.json');
const protect = value => json({ head: value.headSha, firstOpen: value.currentCriterionId, current: value.currentStageId,
  ios: value.verificationCache.s04IosGlobeProjection, owner: value.verificationCache.ownerCatalogWorkflow,
  otherStages: value.stages.filter(stage => stage.id !== 'S11') });
const protectedState = protect(state); assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(stage => stage.id === 'S11'); assert.equal(stage.status, 'IN_PROGRESS');
for (const id of entry.requirementIds) {
  const criterion = stage.criteria.find(item => item.id === 'S11.' + id); assert.equal(criterion.status, 'OPEN');
  criterion.status = 'IN_PROGRESS'; criterion.evidence.push(out + '/result.json');
  criterion.notes += ' Portable QA verification and atomic derived cache are implemented and validated with the real preserved S08 exports. Full application/native transport and activation are not accepted.';
}
stage.artifacts = [...new Set([...stage.artifacts, out + '/entry.json', out + '/result.json'])];
stage.lastGreenCommands = [...new Set([...stage.lastGreenCommands, ...reports.map(name => 'node .tmp/s11-content-intake-20260914/run-checks.mjs ' + name.replace(/-(a\d+)$/u, ' $1'))])];
state.verificationCache.parallelSafeStages.S11.evidence.push(out + '/entry.json');
state.verificationCache.s11ContentIntake = { status: result.status, evidence: out + '/result.json', sha256: sha(json(result)), sourceBaseCommit: head,
  sourceInputsSha256: result.sourceInputsSha256, passingUnitCases: 126, actualChromeCases: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s08ContentExport.sourceInputsCurrent = false;
state.verificationCache.s08ContentExport.subsequentSourceChange = 'S11 extracted shared data protocol; current Node compatibility and preserved S08 signatures/files passed. Original immutable export artifacts retain their exact source identity.';
state.updatedAt = recordedAt; state.resume.nextAction = next + ' First-open S03 remains unchanged.';
state.resume.contextFiles = [...new Set([...state.resume.contextFiles, out + '/entry.json', out + '/result.json'])];
assert.equal(protect(state), protectedState);
const marker = 's11-content-intake-20260914';
const block = '<!-- ' + marker + ':begin -->\nS11 signed QA content integrity and atomic derived cache implemented.\n126 focused tests, TypeScript/platform boundaries and 1 actual Chrome scenario pass.\nExisting S08 RUEN packages survive a failed replacement, simultaneous tab retry\nand browser restart; offline reads verify current/previous bytes, corruption is denied.\nAll candidates remain QA-only; no editorial, purchase or child activation is granted.\nEvidence: evidence/S11/content-intake-20260914/result.json. No full app rebuild repeated.\nNext: bounded package download transport/recovery and platform integration.\nOwner archives sync after application implementation (D107). First-open S03;\nS11 and release gates remain unaccepted. Android048c8e1b/PWA0381b95f and iOS83 preserved.\n<!-- ' + marker + ':end -->\n\n';
const docs = [];
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = base + '/' + name, text = await fs.readFile(file, 'utf8'); assert.ok(!text.includes('<!-- ' + marker + ':begin -->')); docs.push([file, block + text]);
}
const decisionsPath = base + '/DECISIONS.md', decisions = await fs.readFile(decisionsPath, 'utf8'); assert.ok(!/^- D114:/mu.test(decisions));
await fs.writeFile(out + '/entry.json', json(entry), { flag: 'wx' }); await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(base + '/AUTOPILOT_STATE.json', json(state));
for (const [file, text] of docs) await fs.writeFile(file, text);
await fs.writeFile(decisionsPath, decisions.trimEnd() + '\n\n- D114: Share the S08 data-only protocol with an application WebCrypto verifier;\n  pin dedicated public content keys independently from transport and purchase keys.\n  Save QA bytes through a derived CacheStorage generation protected by Web Locks,\n  full RUEN readback and one atomic selection write; retain the previous generation.\n  Actual Chrome verifies preserved exports through interruption, tab concurrency,\n  browser restart and offline corruption rejection. Keep activationAllowed=false;\n  no canonical facts, editorial, child or ownership authority is added. Short dedicated\n  browser profiles avoid the observed Windows CacheStorage environment failure.\n  Continue bounded transport/platform integration before refreshed whole-app artifacts;\n  first-open S03 and D107 final owner archive synchronization remain unchanged.\n');
for (const name of ['run-checks.mjs', 'playwright.config.mjs', 'checkpoint.mjs']) await fs.copyFile('.tmp/s11-content-intake-20260914/' + name, out + '/' + name, fs.constants.COPYFILE_EXCL);
const verification = await verifyExecutionFiles(root);
await fs.writeFile(out + '/state-verification.json', json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, json(verification.errors));
console.log(json({ status: result.status, unitCases: 126, browserCases: 1, firstOpen: state.currentCriterionId,
  stages: Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(stage => stage.status === status).length])), stateVerification: true, releaseReady: false }));
