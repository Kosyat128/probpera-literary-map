import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const folder = 'docs/mobile/evidence/S11/optional-uninstall-20260919';
const sourceCommit = '46df306b76f0e90163a26bb08c840b83123f1924';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
execFileSync('git', ['merge-base', '--is-ancestor', sourceCommit, 'HEAD'], { windowsHide: true });
const equivalent = await read(folder + '/selection-type-fix.json');
assert.equal(equivalent.emittedJavaScriptIdentical, true);
assert.equal(sha(await fs.readFile(equivalent.file)), equivalent.afterSha256);
const runs = {};
for (const name of ['unit-a1', 'browser-a1']) {
  const record = await read(folder + '/' + name + '/result.json');
  assert.ok(record.pass && record.sourceInputsUnchanged);
  for (const input of record.sourceInputs) {
    const actual = sha(await fs.readFile(input.path));
    assert.ok(actual === input.sha256 || (input.path === equivalent.file && input.sha256 === equivalent.beforeSha256 && actual === equivalent.afterSha256), input.path);
  }
  runs[name] = { path: folder + '/' + name + '/result.json', sha256: sha(await fs.readFile(folder + '/' + name + '/result.json')), tests: record.tests };
}
assert.equal(runs['unit-a1'].tests.passed, 167); assert.equal(runs['browser-a1'].tests.passed, 4);
const compile = await read(folder + '/android-compile-a1/result.json');
assert.ok(compile.pass && compile.sourceInputsUnchanged);
for (const item of compile.sourceInputs) assert.equal(sha(await fs.readFile(item.path)), item.sha256);
assert.ok((await read(folder + '/typecheck-final.json')).pass);
assert.equal((await read(folder + '/static-a1/result.json')).executions.find(item => item.name === 'platform-boundaries').exitCode, 0);
const base = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-uninstall/browser-a1/optional-uninstall-optiona-6d666-art-with-explicit-reinstall';
const nextAction = 'Continue immediately with existing reader-progress synchronization in src/hooks/useReadingProgress.ts: prevent delayed remote hydration from overwriting newer local edits, scope debounce and uploads to item plus adult identity, preserve pending changes on transport failure, and keep reset-to-zero valid. Accountless native/PWA remains local only. Preserve current validated uninstall source and Wi-Fi artifacts; batch the next artifact refresh after this shared-reader fix. No production DB/publication/store actions; D107 final archive synchronization remains deferred.';
const result = { schemaVersion: 1, stage: 'S11', status: 'OPTIONAL_PACKAGE_RETIREMENT_SOURCE_VALIDATED', pass: true,
  sourceCommit, recordedAt: new Date().toISOString(), passingUnitCases: 167, actualChromeCases: 4, runs,
  nativeCompilation: folder + '/android-compile-a1/result.json', typecheck: folder + '/typecheck-final.json',
  platformBoundaries: folder + '/static-a1/platform-boundaries.json',
  checks: { trustedRequiredDefault: true, exactConfirmationReceipt: true, atomicRetirement: true,
    retainedVersionFloor: true, epochFencedMutations: true, staleTabsRejected: true, mandatoryBootstrapPreserved: true,
    currentPreviousAndOrphansRemoved: true, cleanupFailureRetry: true, lostAtomicResponseReadback: true,
    offlineRestartAndExplicitReinstall: true, locales: ['ru', 'en'], accessibilityViolations: 0 },
  screenshotsInspectedAtOriginalResolution: await Promise.all(['optional-confirm-ru.png', 'optional-removed-en.png'].map(async name => ({ path: base + '/' + name, sha256: sha(await fs.readFile(base + '/' + name)) }))),
  preservedFailure: { path: folder + '/static-a1/result.json', typeOnlyCorrection: equivalent, finalTypecheckPassed: true },
  nativeConcurrencyLimitation: 'A fresh explicit reinstall from another native JS host may need retry if its unfinished candidate overlaps same-epoch cleanup. Native commit rechecks all bytes; incomplete data cannot be selected.',
  artifactsRefreshed: false, currentPreservedPwa: 'd1e90c35', currentPreservedAndroid: 'b2f77958',
  nativeExecutionVerified: false, iosCompiled: false, productionPackageActivation: false,
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false, nextAction };
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
const file = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(file);
const before = state.stages.map(stage => [stage.id, stage.status]);
state.updatedAt = result.recordedAt; state.resume.nextAction = nextAction;
state.resume.contextFiles.push(folder + '/result.json');
state.resume.doNotRepeat.push('Optional uninstall source 46df306b: 167 focused units, 4 real Chrome cases, final type/platform checks and Android Java compilation passed. No full artifact refresh yet; preserve Wi-Fi PWA d1e90c35 and Android b2f77958.');
state.verificationCache.s11OptionalUninstall = { evidence: folder + '/result.json', sha256: sha(await fs.readFile(folder + '/result.json')),
  sourceCommit, status: result.status, passingUnitCases: 167, actualChromeCases: 4, nativeDeviceTested: false, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(stage => stage.id === 'S11'); stage.artifacts.push(folder + '/result.json');
for (const item of stage.criteria.filter(item => ['S11.CONTENT-006', 'S11.CONTENT-008', 'S11.MOD-041', 'S11.UX-006'].includes(item.id))) {
  item.evidence.push(folder + '/result.json');
  item.notes += ' Optional saved-package removal is app-catalog authorized, exact-selection confirmed and atomically retired with retained version/epoch metadata. Focused source/Chrome and Java compilation pass; native device execution, iOS and global criterion acceptance remain open.';
}
stage.lastGreenCommands.push('node ' + folder + '/run-checks.mjs unit a1', 'node ' + folder + '/run-checks.mjs browser a1',
  'node node_modules/typescript/bin/tsc --noEmit', folder + '/compile-android.ps1');
assert.deepEqual(state.stages.map(stage => [stage.id, stage.status]), before);
await fs.writeFile(file, json(state));
const note = `<!-- s11-optional-uninstall-20260919:begin -->
Source 46df306b implements trusted optional-package removal with exact RU/EN confirmation,
atomic retirement, retained version/epoch metadata and safe cleanup retry. 167 focused
units and 4 actual Chrome cases passed, plus final TypeScript/platform checks and Android
Java compilation. Offline deletion/restart/reinstall, stale-tab confirmation and mandatory
bootstrap protection passed; both narrow-screen locale screenshots inspected.
Evidence: evidence/S11/optional-uninstall-20260919/result.json.
PWA d1e90c35 and Android b2f77958 remain exact preserved Wi-Fi builds, predating uninstall.
Batch the next artifact refresh after the reader-progress fix already being implemented.
Native device/process-death and iOS compilation remain open. No additional stage accepted,
releaseReady false. Same-epoch concurrent native reinstall may need retry; full native
commit validation prevents selecting incomplete bytes. Production QA activation remains off.
Next: repair existing reader hydration/debounce/error recovery with item/account isolation.
D107 final owner archive synchronization stays deferred; no external production action.
<!-- s11-optional-uninstall-20260919:end -->

`;
for (const file of ['docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt']) await fs.writeFile(file, note + await fs.readFile(file, 'utf8'));
await fs.appendFile('docs/mobile/DECISIONS.md', `
- D122: Optional-package removal requires app-trusted retention policy (missing means
  required) and confirmation of the exact local selection. Local v2 retirement preserves
  the last receipt/version and increments an epoch; it never deletes the pointer into
  an ambiguous absent state. Native writes/pruning enforce epochs in the serial IO queue.
  Atomic retirement precedes retryable byte cleanup; late cancellation or lost write
  response cannot imply rollback when exact readback proves retirement. Signed package
  v1 and ordinary incomplete-candidate discard remain unchanged. Source 46df306b has
  167 units, 4 Chrome cases and Java compilation; native device/iOS/release gates remain.
  Continue directly to existing reader-progress sync repair, then batch artifact refresh.
`);
console.log(json({ pass: true, sourceCommit, passingUnitCases: 167, actualChromeCases: 4, stageStatusesUnchanged: true, releaseReady: false }));
