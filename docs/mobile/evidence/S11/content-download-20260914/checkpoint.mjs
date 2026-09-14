import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const base = 'docs/mobile', out = base + '/evidence/S11/content-download-20260914';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const head = execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head, 'a523798e1f1342390fb679fa57248306374c652f');
const reports = ['unit-a1', 'static-a1', 'browser-a1'];
const results = await Promise.all(reports.map(name => read(out + '/' + name + '/result.json')));
for (const result of results) {
  assert.equal(result.pass, true); assert.equal(result.unchanged, true); assert.equal(result.head, head); assert.deepEqual(result.before, result.after);
  for (const input of result.after) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
}
const [unit, checks, browser] = results;
assert.equal(unit.tests.passed, 92); assert.equal(unit.tests.files, 3);
assert.equal(checks.executions.length, 2); assert.ok(checks.executions.every(check => check.exitCode === 0));
assert.equal(browser.tests.passed, 1); assert.equal(browser.tests.flaky, 0);
const proofBytes = await fs.readFile(browser.proof.path); assert.equal(proofBytes.length, browser.proof.bytes); assert.equal(sha(proofBytes), browser.proof.sha256);
const proof = JSON.parse(proofBytes);
assert.equal(proof.pass, true); assert.equal(proof.browserRestarts, 2); assert.equal(proof.offlineReadNetworkRequests, 0); assert.deepEqual(proof.offlineLocales, ['ru', 'en']);
assert.equal(proof.steps.interrupted.ok, false); assert.equal(proof.steps.partialRead.ok, false);
assert.equal(proof.steps.concurrentRetry.length, 2); assert.ok(proof.steps.concurrentRetry.every(result => result.ok && !result.activationAllowed));
assert.deepEqual(proof.counts, { '/packages/v1/dependency-index.json': 1, '/packages/v1/en/catalog.json': 1, '/packages/v1/ru/catalog.json': 1,
  '/packages/v2/dependency-index.json': 1, '/packages/v2/en/catalog.json': 2, '/packages/v2/ru/catalog.json': 2 });
assert.ok(proof.requests.every(request => request.cookie === null && request.referrer === null));
for (const name of ['previousAfterInterruptedBrowserRestart', 'currentAfterCompletedBrowserRestartOffline', 'previousAfterCompletedBrowserRestartOffline']) {
  assert.equal(proof.steps[name].ok, true); assert.equal(proof.steps[name].activationAllowed, false);
}
for (const source of proof.sourceExports) {
  assert.equal(sha(await fs.readFile(source.inspection.path)), source.inspection.sha256);
  for (const file of source.checked) { const bytes = await fs.readFile(file.path); assert.equal(bytes.length, file.bytes); assert.equal(sha(bytes), file.sha256); }
}
const recordedAt = new Date().toISOString();
const entry = { schemaVersion: 1, recordedAt, stage: 'S11', checkpoint: head, route: 'S11-S15',
  precedingEntry: 'docs/mobile/evidence/S11/content-intake-20260914/entry.json', requirementIds: ['CONTENT-005', 'CONTENT-006', 'CONTENT-008'],
  basis: 'Continue the documented parallel-safe S11 integrity/storage scope with explicit signed data transport. Existing canonical content and platform ownership remain intact; this does not certify unresolved editorial, child or release gates.',
  scope: ['Authenticate a caller-pinned manifest before network; bounded credential-free JSON transfer, cancellation and idle timeout.',
    'Persist exact whole verified candidate files, resume from a new document/browser and select only the fully verified RUEN generation.',
    'Serialize downloads separately from short reads and writes so the prior generation remains readable during network activity.'],
  acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
const inputs = unit.after.filter(input => !input.path.startsWith('.tmp/'));
const next = 'Continue S11 by integrating verified package capabilities through the existing Web/native platform adapters and actual download controls around the persistent globe. Establish the native durable storage capability and localized recovery states without activating QA content or treating a CacheStorage browser proof as installed-device acceptance. D107 final owner archive synchronization follows application implementation; no factual archive population.';
const result = { schemaVersion: 1, recordedAt, stage: 'S11', status: 'SOURCE_UNIT_AND_REAL_HTTP_BROWSER_VALIDATION_PASSED', sourceBaseCommit: head,
  entry: out + '/entry.json', requirementIds: entry.requirementIds, sourceInputs: inputs, sourceInputsSha256: sha(json(inputs)),
  implementation: ['src/planet/contentPackageTransport.ts', 'src/planet/verifyContentPackage.ts', 'src/planet/contentPackageCache.ts'],
  tests: ['src/planet/contentPackageTransport.test.mjs', 'src/planet/verifyContentPackage.test.mjs', 'src/planet/contentPackageCache.test.mjs', 'tests/pwa/content-package-download.spec.mjs'],
  validation: { reports: reports.map(name => out + '/' + name + '/result.json'), passingUnitCases: 92, unitFiles: 3, typecheck: true, platformBoundaries: true,
    actualHttpChromeCases: 1, browserProof: browser.proof, retries: 0, browserRestarts: 2,
    regressionScope: 'Existing cache/signature cases plus new manifest preflight and transfer cases. Unchanged Node signer/protocol tests retain the preceding 126-case checkpoint; test counts are not added as unique coverage.',
    notRepeated: 'Unchanged worker bootstrap suite, full application/Android builds and screenshot cases.' },
  behavior: ['Verify dedicated content signature and independently supplied canonical manifest hash before any data request.',
    'Construct only JSON file URLs below the explicit HTTPS or QA loopback base. Omit cookies/referrer and prohibit redirects; enforce exact uncompressed byte lengths, SHA256, MIME, cancellation and idle timeouts.',
    'Persist only whole hash-verified candidate files. A failed response never becomes a selected generation; retries rehash cached files and refetch only missing or corrupt ones.',
    'Separate download locks from short selection/storage locks; existing complete data remains readable while another network request is stalled.',
    'Concurrent documents share the retained files and compare prior generation receipts; a late transfer cannot overwrite a separately committed newer generation.',
    'Final selection still requires the complete data-only RUEN verification and readback. All receipts remain local-qa and cannot authorize content, purchases or child mode.'],
  limits: ['Derived best-effort browser storage and whole-file retry, not byte-range resume or a guarantee against OS eviction.',
    'Callable application modules with a real HTTP/Chrome harness; native adapters, user-facing controls and production package activation remain unintegrated.',
    'Harness scripts load before offline mode; the preserved package bytes themselves are read with network disabled. No whole-application or exact-RC claim.',
    'Existing S08 data is a preserved QA candidate, not the owner final archive or new editorial approval.'],
  fullApplicationBuildRepeated: false, canonicalFactsChanged: false, editorialApprovalCreated: false, ownerWorkflow: 'D107',
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false, next };
await assert.rejects(fs.stat(out + '/result.json'), { code: 'ENOENT' });
const state = await read(base + '/AUTOPILOT_STATE.json');
const protect = value => json({ head: value.headSha, firstOpen: value.currentCriterionId, current: value.currentStageId, bilingual: value.bilingual,
  ios: value.verificationCache.s04IosGlobeProjection, owner: value.verificationCache.ownerCatalogWorkflow, otherStages: value.stages.filter(stage => stage.id !== 'S11') });
const protectedState = protect(state); assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(stage => stage.id === 'S11'); assert.equal(stage.status, 'IN_PROGRESS');
for (const id of entry.requirementIds) {
  const criterion = stage.criteria.find(item => item.id === 'S11.' + id); assert.equal(criterion.status, 'IN_PROGRESS');
  criterion.evidence.push(out + '/result.json'); criterion.notes += ' Signed whole-file network recovery passes real HTTP interruption, browser restart and two-document retry. Native/user-facing integration remains open.';
}
stage.artifacts = [...new Set([...stage.artifacts, out + '/entry.json', out + '/result.json'])];
stage.lastGreenCommands = [...new Set([...stage.lastGreenCommands, ...reports.map(name => 'node .tmp/s11-content-download-20260914/run-checks.mjs ' + name.replace(/-(a\d+)$/u, ' $1'))])];
state.verificationCache.parallelSafeStages.S11.evidence.push(out + '/entry.json');
state.verificationCache.s11ContentDownload = { status: result.status, evidence: out + '/result.json', sha256: sha(json(result)), sourceBaseCommit: head,
  sourceInputsSha256: result.sourceInputsSha256, passingUnitCases: 92, actualHttpChromeCases: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s11ContentIntake.sourceInputsCurrent = false;
state.verificationCache.s11ContentIntake.successor = out + '/result.json';
state.updatedAt = recordedAt; state.resume.nextAction = next + ' First-open S03 remains unchanged.';
state.resume.contextFiles = [...new Set([...state.resume.contextFiles, out + '/entry.json', out + '/result.json'])]; assert.equal(protect(state), protectedState);
const marker = 's11-content-download-20260914';
const block = '<!-- ' + marker + ':begin -->\nS11 signed package network transfer and whole-file recovery implemented.\n92 focused cases, TypeScript/platform boundaries and 1 actual HTTP/Chrome scenario pass.\nAfter a real interrupted RU response and browser restart, the valid dependency file\nwas reused; damaged EN and incomplete RU were refetched. Two tabs avoided duplicate\ndownloads; both complete generations passed offline reads after another restart.\nPrior content remains readable during transfer. Requests omit cookies and referrer.\nAll content remains QA-only; native adapters and user-facing download controls are next.\nEvidence: evidence/S11/content-download-20260914/result.json. No full app build repeated.\nOwner archives sync after app implementation (D107). First-open S03 and release gates\nremain unchanged; Android048c8e1b/PWA0381b95f and frozen iOS83 are preserved.\n<!-- ' + marker + ':end -->\n\n';
const docs = [];
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = base + '/' + name, text = await fs.readFile(file, 'utf8'); assert.ok(!text.includes('<!-- ' + marker + ':begin -->')); docs.push([file, block + text]);
}
const decisionsPath = base + '/DECISIONS.md', decisions = await fs.readFile(decisionsPath, 'utf8'); assert.ok(!/^- D115:/mu.test(decisions));
await fs.writeFile(out + '/entry.json', json(entry), { flag: 'wx' }); await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(base + '/AUTOPILOT_STATE.json', json(state)); for (const [file, text] of docs) await fs.writeFile(file, text);
await fs.writeFile(decisionsPath, decisions.trimEnd() + '\n\n- D115: Authenticate the pinned content manifest before fetching data. Bound\n  explicit JSON transfers, omit credentials/referrer, reject redirects, and support\n  cancellation and idle timeouts. Retain only whole hash-verified candidate files\n  for retries. Separate transfer and short storage locks so previous data remains\n  readable; keep final full RUEN selection atomic. Actual HTTP/Chrome proof covers\n  interruption, corrupted cached EN, two browser restarts, concurrent tab retry\n  and offline current/previous reads. Native storage and globe download controls\n  remain next; no QA activation, final content fill or release acceptance.\n');
for (const name of ['run-checks.mjs', 'playwright.config.mjs', 'checkpoint.mjs', 'prepare-checks.mjs']) await fs.copyFile('.tmp/s11-content-download-20260914/' + name, out + '/' + name, fs.constants.COPYFILE_EXCL);
const verification = await verifyExecutionFiles(root); await fs.writeFile(out + '/state-verification.json', json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, json(verification.errors));
console.log(json({ status: result.status, unitCases: 92, actualHttpChromeCases: 1, firstOpen: state.currentCriterionId,
  stages: Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(stage => stage.status === status).length])), stateVerification: true, releaseReady: false }));
