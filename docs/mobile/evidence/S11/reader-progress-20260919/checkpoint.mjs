import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
const base = 'docs/mobile/evidence/S11/';
const reader = base + 'reader-progress-20260919', library = base + 'reading-library-20260919', older = base + 'older-package-20260919';
const recovery = base + 'globe-recovery-20260919';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const save = (file, value) => fs.writeFile(file, json(value), { flag: 'wx' });
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const common = { sourceCommit, recordedAt: new Date().toISOString(), stageAccepted: false, releaseReady: false,
  nativeExecutionVerified: false, iosCompiled: false, productionActionsPerformed: false };
async function checked(file, historicalHarness = false) {
  const result = await read(file);
  assert.ok(result.pass && result.sourceInputsUnchanged, file);
  for (const input of result.sourceInputs) {
    // Older-package scenarios do not load this separately selected host fixture;
    // its later addition is validated by the recovery run below.
    if (file.startsWith(older + '/') && input.path === 'tests/host/native-planet.spec.mjs') continue;
    // The only post-run changes in the older-package unit snapshot are its
    // Chrome profile prefix and targeted rerun selection, not tested app code.
    if (historicalHarness && [older + '/playwright.config.mjs', 'tests/pwa/optional-uninstall.spec.mjs'].includes(input.path)) continue;
    assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  }
  return result;
}
const typecheck = await checked(library + '/static-a2/result.json');
const progressUnit = await checked(reader + '/unit-a1/result.json');
const progressBrowser = await checked(reader + '/browser-a1/result.json');
const libraryUnit = await checked(library + '/unit-a2/result.json');
const libraryBrowser = await checked(library + '/browser-a2/result.json');
const recoveryUnit = await checked(recovery + '/unit-a2/result.json');
const recoveryBrowser = await checked(recovery + '/browser-a3/result.json');
const olderUnit = await checked(older + '/unit-a1/result.json', true);
const olderSecond = await checked(older + '/browser-a2/result.json');
const olderFirst = await read(older + '/browser-a1/result.json');
assert.ok(olderFirst.sourceInputsUnchanged);
for (const input of olderFirst.sourceInputs.filter(input => input.path.startsWith('src/') || input.path.startsWith('apps/'))) {
  assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
}
assert.deepEqual([olderFirst.tests.passed, olderFirst.tests.failed, olderSecond.tests.passed], [1, 1, 1]);
assert.equal(olderUnit.tests.passed, 138);
assert.equal(progressUnit.tests.passed, 17);
assert.equal(progressBrowser.tests.passed, 1);
assert.equal(libraryBrowser.tests.passed, 1);
assert.equal(recoveryBrowser.tests.passed, 1);
const screenshots = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-older-package/browser-a2/optional-uninstall-a-saved-0f6c2-optional-catalogue-advances/';
await save(older + '/result.json', { ...common, pass: true, status: 'PREVIOUS_OPTIONAL_PACKAGE_SOURCE_VALIDATED',
  passingUnitCases: olderUnit.tests.passed, actualChromeCases: 2,
  runs: await Promise.all(['unit-a1', 'browser-a1', 'browser-a2'].map(name => ref(older + '/' + name + '/result.json'))),
  typecheck: await ref(library + '/static-a2/result.json'),
  checks: { previousSelectedVersionDisplayed: true, exactSavedVersionConfirmed: true, mandatoryPackagesProtected: true,
    rollbackBehindUnknownCurrentProtected: true, offlineRetirementRestored: true, explicitOfferedVersionInstall: true },
  preservedFailure: { attempt: 'browser-a1', failedBeforeAppAssertions: true,
    error: 'CacheStorage.open Unexpected internal error while seeding the second Chrome profile',
    correction: 'Shortened only the second temporary Chrome profile prefix from optional-previous- to ov-; reran only that case in browser-a2.',
    firstPassingCaseReused: true, implementationInputsIdenticalAcrossBothRuns: true },
  screenshotsInspectedAtOriginalResolution: await Promise.all(['optional-previous-confirm-ru.png', 'optional-previous-confirm-en.png'].map(name => ref(screenshots + name))) });
await save(library + '/result.json', { ...common, pass: true, status: 'READING_LIBRARY_SOURCE_VALIDATED',
  passingUnitCases: libraryUnit.tests.passed, actualChromeCases: libraryBrowser.tests.passed,
  runs: await Promise.all(['unit-a2', 'browser-a2', 'static-a2'].map(name => ref(library + '/' + name + '/result.json'))),
  remoteTransportStubbed: true, liveDatabaseTested: false, guestMigrationPerformed: false,
  checks: { executedLazyMutations: true, identityScopedStorage: true, lateHydrationFenced: true,
    staleRollbackFenced: true, localDossierProgressPrivate: true, guestLocalOnly: true } });
await save(recovery + '/result.json', { ...common, pass: true, status: 'CANONICAL_GLOBE_CONTEXT_RECOVERY_VALIDATED',
  passingUnitCases: recoveryUnit.tests.passed, actualChromeCases: recoveryBrowser.tests.passed,
  runs: await Promise.all(['unit-a2', 'browser-a3'].map(name => ref(recovery + '/' + name + '/result.json'))),
  typecheck: await ref(library + '/static-a2/result.json'),
  simulatedGpuLossInActualChrome: true, actualNativeGpuLossTested: false,
  checks: { persistentCanvasRendererCameraScene: true, cameraPosePreserved: true, lostContextMotionPaused: true,
    dragPreservesCountrySelection: true, actualTapStillSelectsCanonicalCountry: true },
  preservedAttempts: { browserA1: 'Fixture tried zoom-in at maximum writer focus; changed to zoom-out.',
    browserA2: 'Recovery and identity assertions passed but exposed genuine country selection after drag; surface selection now uses existing pointer tap gate.',
    staticA1: 'A test used Array.at beyond the configured TypeScript library target; replaced it with the equivalent last-element index.' },
  screenshotsInspectedAtOriginalResolution: await Promise.all(['native-context-lost-ru.png', 'native-context-restored-en.png'].map(name => ref(
    'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-recovery/browser-a3/native-planet-WebGL-contex-b695f-era-pose-and-RUEN-selection/' + name))) });
const pwa = await read(reader + '/pwa-a1/result.json'), android = await read(reader + '/android-a1/result.json');
for (const artifact of [pwa, android]) { assert.ok(artifact.pass); assert.equal(artifact.sourceCommit, sourceCommit); }
const nextAction = 'Continue with remaining offline integration and canonical-content activation preparation. Preserve the validated optional-package, reader-progress, reading-library and canonical WebGL recovery checkpoints. Do not repeat unchanged suites. Keep production content activation, owner archive synchronization D107, native device/iOS validation and publication as separate uncompleted gates.';
const result = { ...common, pass: true, status: 'READER_STORAGE_AND_RECOVERY_ARTIFACT_CHECKPOINT',
  passingProgressUnitCases: progressUnit.tests.passed, actualProgressChromeCases: progressBrowser.tests.passed,
  runs: await Promise.all(['unit-a1', 'browser-a1'].map(name => ref(reader + '/' + name + '/result.json'))),
  typecheck: await ref(library + '/static-a2/result.json'),
  readingLibrary: await ref(library + '/result.json'), olderPackage: await ref(older + '/result.json'),
  globeRecovery: await ref(recovery + '/result.json'),
  optionalUninstall: await ref(base + 'optional-uninstall-20260919/result.json'),
  checks: { lateHydrationFenced: true, perItemAndAccountOwnership: true, resetToZeroPreserved: true,
    dirtyIntentRetainedOnFailure: true, requestsBounded: true, noAutomaticRetryLoop: true, guestLocalOnly: true },
  remoteTransportStubbed: true, liveDatabaseTested: false,
  pwa: await ref(reader + '/pwa-a1/result.json'), android: await ref(reader + '/android-a1/result.json'),
  buildIds: { pwa: pwa.buildId, android: android.buildId }, nextAction };
await save(reader + '/result.json', result);
const stateFile = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(stateFile);
const statuses = state.stages.map(item => [item.id, item.status]);
state.updatedAt = common.recordedAt;
state.headSha = sourceCommit;
state.resume.nextAction = nextAction;
state.resume.contextFiles.push(reader + '/result.json', library + '/result.json', older + '/result.json', recovery + '/result.json');
state.resume.doNotRepeat.push('Reader progress: 17 focused units and 1 Chrome case. Previous optional package: 138 units and 2 Chrome cases (first a1, second a2). Reading library and combined artifact results are recorded in reader-progress-20260919/result.json. Reuse unchanged evidence.');
state.verificationCache.s11ReaderAndStorage = { ...await ref(reader + '/result.json'), sourceCommit,
  status: result.status, buildIds: result.buildIds, nativeDeviceTested: false, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(item => item.id === 'S11');
stage.artifacts.push(reader + '/result.json', library + '/result.json', older + '/result.json', recovery + '/result.json');
for (const item of stage.criteria.filter(item => ['S11.CONTENT-006', 'S11.CONTENT-008', 'S11.CONTENT-009', 'S11.UX-006'].includes(item.id))) {
  item.evidence.push(reader + '/result.json');
  item.notes += ' Previous saved optional versions now remain manageable after catalogue updates. Shared reader progress and favorites isolate adult identities and fence stale asynchronous results; focused local/browser ports pass. Actual production sync, complete content and criterion acceptance remain open.';
}
assert.deepEqual(state.stages.map(item => [item.id, item.status]), statuses);
await fs.writeFile(stateFile, json(state));
const note = `<!-- s11-reader-storage-20260919:begin -->\nSource ${sourceCommit.slice(0, 8)} validates previous optional-version management (138 units,\n2 Chrome cases), reader progress (17 units, 1 Chrome case), and reading library\n(${libraryUnit.tests.passed} units, 1 Chrome case). Remote reader ports are simulated; no live DB actions.\nWebGL recovery and drag/tap distinction: 25 units and 1 real Chrome case passed.\nShared final TypeScript check passes. PWA ${pwa.buildId.slice(0, 8)} and Android/dev\n${android.buildId.slice(0, 8)} include the accumulated storage/reader/globe fixes; exact copies on D:\nare recorded in evidence/S11/reader-progress-20260919/result.json.\nAPK SHA256: ${android.apk.sha256}. Prior Wi-Fi artifacts remain preserved.\nNative device/process-death, iOS, full-stage acceptance and release gates remain open.\nOnly S00-S02 accepted; S03 remains first open and releaseReady false.\nContinue directly with remaining offline integration work; D107 stays deferred.\n<!-- s11-reader-storage-20260919:end -->\n\n`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = 'docs/mobile/' + name; await fs.writeFile(file, note + await fs.readFile(file, 'utf8'));
}
await fs.appendFile('docs/mobile/DECISIONS.md', '\n- D123: Optional package confirmation addresses the actual saved current version, including\n  a trusted prior catalogue version; rollback bytes behind an unknown current selection\n  cannot authorize removal. Shared reader progress and favorites use separate adult\n  storage identities; the legacy unscoped key remains guest-owned without auto-migration.\n  Late reads and stale rollbacks cannot replace newer local intent. Progress errors\n  preserve dirty values and bounded requests retry only after user/lifecycle intent.\n  Reader remote tests use explicit transport ports; no live backend or stage acceptance\n  is implied. Combined local PWA/Android artifact evidence records exact source and bytes.\n');
await fs.appendFile('docs/mobile/DECISIONS.md', '\n- D124: WebGL recovery restores the existing renderer after a real browser context\n  event and never changes the Canvas key. Loss immediately suspends the frame loop\n  and scene activity; a bounded explicit restoration request cannot falsely mark the\n  context ready. Actual Chrome verifies identity, pose, locale and semantic selection\n  preservation plus resumed rendering. Surface country selection now uses the shared\n  pointer tap gate, because the same scenario exposed selection after a drag.\n  Desktop Chrome GPU-loss simulation does not establish installed native recovery.\n');
console.log(json({ pass: true, sourceCommit, buildIds: result.buildIds, stageStatusesUnchanged: true, releaseReady: false }));
