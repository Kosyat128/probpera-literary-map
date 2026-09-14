import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const folder = 'docs/mobile/evidence/S11/storage-management-20260914';
const sourceCommit = 'c0dba72eb23f48eb6e1a0ea92a44e8cd75e4107c';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const parse = async file => JSON.parse(await fs.readFile(file, 'utf8'));
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const runs = {};
for (const name of ['unit-a1', 'static-a1', 'browser-a2', 'globe-a1']) {
  const file = folder + '/' + name + '/result.json', record = await parse(file);
  assert.ok(record.pass && record.sourceInputsUnchanged);
  // These are the actual application/native inputs shared by the checks. Test
  // harness changes are tracked separately and never relabelled as app fixes.
  const implementationInputs = record.sourceInputs.filter(item => /^(?:src|apps\/mobile)\//u.test(item.path));
  for (const item of implementationInputs) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
  runs[name] = { path: file, sha256: sha(await fs.readFile(file)), tests: record.tests,
    applicationAndNativeInputsMatchSourceCommit: true, checkedInputCount: implementationInputs.length };
}
assert.equal(runs['unit-a1'].tests.passed, 301);
assert.equal(runs['browser-a2'].tests.passed + runs['globe-a1'].tests.passed, 6);
const compile = await parse(folder + '/android-compile-a1/result.json'), privacy = await parse(folder + '/ios-privacy.json');
assert.ok(compile.pass && privacy.pass);
for (const input of compile.sourceInputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256);
assert.equal(sha(await fs.readFile(privacy.source)), privacy.sha256);
const android = await parse(folder + '/android-a1/result.json'); assert.ok(android.pass); assert.equal(android.sourceCommit, sourceCommit);
const pwa = await parse('docs/mobile/evidence/S11/download-lifecycle-20260914/pwa-a1/result.json');
const pwaBytes = await fs.readFile('dist-pwa/artifact.json');
assert.equal(JSON.parse(pwaBytes).buildId, 'c6c50755a43ec051f38d7168ea47d8df260c09c854cb336aaebf22c4c4d7fb24');
assert.equal(sha(pwaBytes), 'e2fae5ccdcea7eaa5aedf2985b3d74b802cc99b0c331866acc86748014b52984');
const images = [
  'browser-a2/storage-management-storage-9bb4e-ons-across-tabs-and-restart/cleared-en.png',
  'browser-a2/storage-management-storage-9bb4e-ons-across-tabs-and-restart/space-ru.png',
  'globe-a1/native-planet-downloads-li-bca83--through-RUEN-and-reopening/downloads-canonical-globe-source.png',
];
const base = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-storage';
const nextAction = 'Continue S11 with the Wi-Fi-only download preference and truthful network-type capabilities, following document18 and existing platform lifetime services. Keep unknown network types explicit; preserve whole-file resume, protected current/previous/bootstrap, one canonical globe and equal RU/EN controls. Reuse the current 301 unit and 6 Chrome cases when relevant inputs are unchanged. Android/dev 3144732d now includes lifecycle and storage controls but has no installed-device/process-death evidence; iOS source and privacy XML are prepared but uncompiled. PWA c6c50755 predates storage management; refresh after the next bounded Web integration slice. Keep production descriptors/trust empty and QA bytes inactive. D107 final owner archive synchronization stays deferred. No public CI upload, deploy, merge or store action.';
const result = { schemaVersion: 1, stage: 'S11', status: 'SOURCE_STORAGE_CONTROLS_AND_ANDROID_ARTIFACT_VALIDATED', pass: true,
  sourceCommit, recordedAt: new Date().toISOString(), passingUnitCases: 301, actualChromeCases: 6, runs,
  validation: { androidCompilation: folder + '/android-compile-a1/result.json', iosPrivacyXmlOnly: folder + '/ios-privacy.json',
    androidArtifact: folder + '/android-a1/result.json', typecheckAndPlatformBoundaries: true,
    crossTabCommitProtection: true, currentPreviousAndBootstrapPreserved: true, browserRestartOfflineRead: true,
    browserOriginEstimateAndUnavailableRecovery: true, canonicalGlobeRetained: true, locales: ['ru', 'en'] },
  screenshotsInspectedAtOriginalResolution: await Promise.all(images.map(async relative => ({ path: base + '/' + relative,
    sha256: sha(await fs.readFile(base + '/' + relative)) }))),
  preservedFailures: { browser: { path: folder + '/browser-a1/result.json', cause: 'RU button locator after EN language synchronized across tabs',
    correction: 'Follow the canonical synchronized language; no application change required' },
    buildBootstrap: folder + '/build-bootstrap-a1.json', testLineEndings: folder + '/test-line-endings.json' },
  spaceDisplayOnly: true, diskSpaceTelemetryOrPersistence: false, capacityTimeoutMs: 5000,
  removalScope: 'One unfinished adult candidate; selected current/previous versions and mandatory bootstrap remain protected',
  productionPackageActivation: false, stageAccepted: false, releaseReady: false, nativeExecutionVerified: false, iosCompiled: false,
  pwaBuildIdUnchanged: JSON.parse(pwaBytes).buildId, pwaIncludesStorageManagement: false, androidBuildId: android.buildId, nextAction };
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
const stateFile = 'docs/mobile/AUTOPILOT_STATE.json', state = await parse(stateFile);
const stagesBefore = state.stages.map(stage => [stage.id, stage.status]);
assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance');
state.updatedAt = result.recordedAt; state.resume.nextAction = nextAction;
state.resume.contextFiles.push(folder + '/result.json', folder + '/android-a1/result.json');
state.resume.doNotRepeat.push('Storage source c0dba72e: 301 units, 6 Chrome cases, type/platform checks and Android 3144732d binary/copy audit passed. Tests/browser callbacks are not installed native execution.');
state.verificationCache.s11StorageManagement = { status: result.status, evidence: folder + '/result.json',
  sha256: sha(await fs.readFile(folder + '/result.json')), sourceCommit, passingUnitCases: 301, actualChromeCases: 6,
  sourceInputsCurrent: true, nativeDeviceTested: false, stageAccepted: false, releaseReady: false };
state.verificationCache.s11StorageAndroid = { status: 'BUILD_BINARY_AUDIT_AND_EXACT_COPY_PASSED', evidence: folder + '/android-a1/result.json',
  sha256: sha(await fs.readFile(folder + '/android-a1/result.json')), sourceCommit, buildId: android.buildId,
  apk: android.apk, artifact: android.artifact, nativeDeviceTested: false, iosCompiled: false, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(stage => stage.id === 'S11');
stage.artifacts.push(folder + '/result.json', folder + '/android-a1/result.json');
stage.lastGreenCommands.push(...['unit a1', 'static a1', 'browser a2', 'globe a1'].map(args => 'node ' + folder + '/run-checks.mjs ' + args),
  folder + '/compile-android.ps1', folder + '/verify-ios-privacy.ps1', folder + '/build-android.ps1 -expectedSource ' + sourceCommit,
  'node ' + folder + '/preserve-android.mjs');
for (const item of stage.criteria.filter(item => ['S11.CONTENT-006', 'S11.CONTENT-008', 'S11.MOD-041'].includes(item.id))) {
  item.evidence.push(folder + '/result.json');
  item.notes += ' Storage capacity display and explicit incomplete-candidate removal are implemented; real Chrome verifies cross-tab commit protection and offline current/previous reads. Android/dev packaging passes, with native device execution and full criterion acceptance still open.';
}
assert.deepEqual(state.stages.map(stage => [stage.id, stage.status]), stagesBefore);
await fs.writeFile(stateFile, json(state));
const note = `<!-- s11-storage-management-20260914:begin -->
S11 storage controls are validated from source c0dba72e: 301 unit cases, 6 actual Chrome
cases, TypeScript/platform checks and Android compilation passed. RU/EN shows browser
origin estimates or native device capacity on request. A 5-second timeout reports unknown
space truthfully. Removing one incomplete adult download keeps current/previous and the
mandatory bootstrap protected, including a competing tab that finishes committing first.
Browser-a1 failure was a stale RU locator after cross-tab EN synchronization; browser-a2
passes after fixing the test. Original-resolution RU/EN and canonical panel images inspected.
Evidence: evidence/S11/storage-management-20260914/result.json.
Android/dev 3144732d was built from this exact source and passed strict runtime, APK
ZIP/CRC/assets, locales, signature, alignment and DEX checks. Exact 67,586,005-byte APK
and 1403-file runtime copy are preserved under the current D: workspace s11-storage folder.
APK SHA256: fa66d74be6491149b89c1acbe6ae92c62b855398fcc53518e5eb05d8215731dd
Prior Android a83dfcd6 remains byte-for-byte preserved. PWA c6c50755 remains at its earlier
lifecycle source; storage management is not included in that PWA artifact. iOS privacy XML
validates display-only disk-space reason 85F4.1; iOS is uncompiled and native device/process-
death execution is unverified. Only S00-S02 accepted; first-open S03 and all release gates stay.
Next: Wi-Fi-only preference and truthful network-type handling; then refresh the PWA.
Production descriptors/trust stay empty, QA bytes inactive and D107 final archive sync deferred.
<!-- s11-storage-management-20260914:end -->

`;
for (const file of ['docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt']) {
  const prior = await fs.readFile(file, 'utf8'); assert.ok(!prior.includes('s11-storage-management-20260914:begin'));
  await fs.writeFile(file, note + prior);
}
await fs.appendFile('docs/mobile/DECISIONS.md', `
- D120: S11 capacity is display-only and never persisted or sent off-device. Browser
  values are origin quota estimates; Android uses app-available volume bytes and iOS
  declares reason 85F4.1 for user-visible space information. A bounded explicit query
  remains available without an approved package catalogue. Cleanup removes only an
  unfinished adult candidate, with transfer/selection lock ordering and native serial
  protection of current/previous versions. Source c0dba72e has 301 units and 6 Chrome
  cases; Android/dev 3144732d passes strict artifact, binary and exact-copy checks.
  Preserve the prior APK/PWA; no native execution, iOS compilation, stage acceptance,
  production activation or release approval is inferred. Continue with Wi-Fi-only
  controls before the next PWA refresh; D107 final owner archive sync stays deferred.
`);
console.log(json({ pass: true, sourceCommit, unitCases: 301, chromeCases: 6, androidBuildId: android.buildId,
  firstOpen: state.resume.firstOpenCriterion, stageStatusesUnchanged: true, releaseReady: false }));
