import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const folder = 'docs/mobile/evidence/S11/wifi-policy-20260919';
const sourceCommit = '7f6f280256d16e33901e65826814adb8401ed5c2';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const parse = async file => JSON.parse(await fs.readFile(file, 'utf8'));
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const equivalents = await Promise.all(['navigator-type-fix.json', 'globe-line-endings.json'].map(name => parse(folder + '/' + name)));
for (const fix of equivalents) {
  assert.equal(fix.emittedJavaScriptIdentical, true);
  assert.equal(sha(await fs.readFile(fix.file)), fix.afterSha256);
}
async function checkInput(file, expected) {
  const current = sha(await fs.readFile(file));
  if (current === expected) return;
  assert.ok(equivalents.some(fix => fix.file === file && fix.beforeSha256 === expected && fix.afterSha256 === current), file);
}
const runs = {};
for (const name of ['unit-a1', 'browser-a1', 'globe-a1']) {
  const file = folder + '/' + name + '/result.json', record = await parse(file);
  assert.ok(record.pass && record.sourceInputsUnchanged);
  for (const item of record.sourceInputs) await checkInput(item.path, item.sha256);
  runs[name] = { path: file, sha256: sha(await fs.readFile(file)), tests: record.tests,
    checkedInputCount: record.sourceInputs.length, runtimeInputsMatchSourceCommit: true };
}
const platform = await parse(folder + '/platform-unit.json');
assert.equal(platform.exitCode, 0); assert.equal(platform.testsPassed, 171);
for (const [file, expected] of Object.entries(platform.sourceSha256)) await checkInput(file, expected);
assert.equal(runs['unit-a1'].tests.passed, 108);
assert.equal(runs['browser-a1'].tests.passed + runs['globe-a1'].tests.passed, 5);
const staticRun = await parse(folder + '/static-a1/result.json'), typecheck = await parse(folder + '/typecheck-final.json');
assert.equal(staticRun.executions.find(run => run.name === 'platform-boundaries').exitCode, 0);
assert.ok(typecheck.pass); assert.equal(typecheck.exitCode, 0);
const android = await parse(folder + '/android-a1/result.json'), pwa = await parse(folder + '/pwa-a1/result.json');
for (const build of [android, pwa]) { assert.ok(build.pass); assert.equal(build.sourceCommit, sourceCommit); }
assert.equal(pwa.browser.expected, 1); assert.equal(pwa.browser.unexpected, 0);
assert.equal(sha(await fs.readFile(android.apk.path)), android.apk.sha256);
for (const [artifactPath, expected] of [[android.artifact.path, android.artifact.sha256], [pwa.artifact.path, pwa.artifact.artifactSha256]]) {
  const bytes = await fs.readFile(artifactPath + '/artifact.json'); assert.equal(sha(bytes), expected);
  const artifact = JSON.parse(bytes);
  for (const input of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
}
const base = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-wifi';
const inspected = [
  'browser-a1/download-network-policy-Wi-3fbc1-ists-with-explicit-recovery/wifi-waiting-en.png',
  'globe-a1/native-planet-native-host--493c3-and-resumes-preserved-state/native-host-interrupted-drag.png',
  'pwa-a1/downloads-artifact-built-P-ba6df-ter-cold-offline-navigation/pwa-downloads-ru.png',
  'pwa-a1/downloads-artifact-built-P-ba6df-ter-cold-offline-navigation/pwa-downloads-en.png',
];
const nextAction = 'Continue S11 optional-package uninstall: saved optional packages currently cannot be removed. Add a separately authorized optional-package operation, keeping incomplete-candidate discard and mandatory bootstrap protection unchanged. Use trusted classification, exact selection/transfer locking and fail-closed concurrent update handling, with equal RU/EN controls. Preserve the verified Wi-Fi source and current PWA d1e90c35 / Android b2f77958 artifacts; rerun only checks affected by the next change. Native installed-device/process-death and iOS compilation remain open. Production descriptors/trust stay empty and QA bytes inactive. D107 final owner archive synchronization stays deferred. No public CI upload, deploy, merge or store action.';
const result = { schemaVersion: 1, stage: 'S11', status: 'WIFI_POLICY_AND_GLOBE_RECOVERY_WITH_PWA_ANDROID_ARTIFACTS_VALIDATED', pass: true,
  sourceCommit, recordedAt: new Date().toISOString(), passingUnitCases: 279, actualChromeCases: 6, runs,
  platformUnits: { path: folder + '/platform-unit.json', tests: 171, sha256: sha(await fs.readFile(folder + '/platform-unit.json')) },
  validation: { typecheck: folder + '/typecheck-final.json', platformBoundaries: folder + '/static-a1/platform-boundaries.json',
    pwaArtifact: folder + '/pwa-a1/result.json', androidArtifact: folder + '/android-a1/result.json',
    unknownNetworkFailsClosed: true, synchronousFetchBoundaryChecks: true, explicitResumeOnly: true,
    preferencePersistsThroughOfflineColdStart: true, backgroundInvalidatesNativeWifi: true,
    interruptedGlobeGestureRecovery: true, canonicalGlobeRetained: true, locales: ['ru', 'en'] },
  screenshotsInspectedAtOriginalResolution: await Promise.all(inspected.map(async relative => ({ path: base + '/' + relative,
    sha256: sha(await fs.readFile(base + '/' + relative)) }))),
  preservedFailure: { path: folder + '/static-a1/result.json', cause: 'DOM Navigator union omitted the optional Network Information capability',
    correctedBy: folder + '/navigator-type-fix.json', finalTypecheckPassed: true },
  nonRuntimeChangesAfterTests: equivalents, unchangedRuntimeSuitesNotRepeated: true,
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId,
  productionPackageActivation: false, nativeExecutionVerified: false, iosCompiled: false,
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false, nextAction };
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
const stateFile = 'docs/mobile/AUTOPILOT_STATE.json', state = await parse(stateFile);
const statuses = state.stages.map(stage => [stage.id, stage.status]);
assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance');
state.updatedAt = result.recordedAt; state.resume.nextAction = nextAction;
state.resume.contextFiles.push(folder + '/result.json', folder + '/pwa-a1/result.json', folder + '/android-a1/result.json');
state.resume.doNotRepeat.push('Wi-Fi source 7f6f2802: 279 focused units and 6 Chrome cases passed; type-only Navigator fix and LF normalization emit identical JavaScript. PWA d1e90c35 and Android b2f77958 strict audits/exact copies passed. Native callback fixtures do not establish installed-device execution.');
state.verificationCache.s11WifiPolicy = { status: result.status, evidence: folder + '/result.json',
  sha256: sha(await fs.readFile(folder + '/result.json')), sourceCommit, passingUnitCases: 279, actualChromeCases: 6,
  runtimeInputsCurrent: true, stageAccepted: false, releaseReady: false };
for (const [name, build, relative] of [['s11WifiPwa', pwa, 'pwa-a1'], ['s11WifiAndroid', android, 'android-a1']]) {
  state.verificationCache[name] = { status: 'BUILD_STRICT_AUDIT_AND_EXACT_COPY_PASSED', evidence: folder + '/' + relative + '/result.json',
    sha256: sha(await fs.readFile(folder + '/' + relative + '/result.json')), sourceCommit, buildId: build.buildId,
    artifact: build.artifact, ...(build.apk ? { apk: build.apk } : {}), nativeDeviceTested: false, stageAccepted: false, releaseReady: false };
}
const stage = state.stages.find(stage => stage.id === 'S11');
stage.artifacts.push(folder + '/result.json', folder + '/pwa-a1/result.json', folder + '/android-a1/result.json');
stage.lastGreenCommands.push(...['unit a1', 'browser a1', 'globe a1'].map(args => 'node ' + folder + '/run-checks.mjs ' + args),
  platform.command, 'node node_modules/typescript/bin/tsc --noEmit',
  'node ' + folder + '/run-pwa.mjs ' + sourceCommit,
  folder + '/build-android.ps1 -expectedSource ' + sourceCommit, 'node ' + folder + '/preserve-android.mjs');
for (const item of stage.criteria.filter(item => ['S11.CONTENT-006', 'S11.CONTENT-008', 'S11.MOD-041', 'S11.UX-006'].includes(item.id))) {
  item.evidence.push(folder + '/result.json');
  item.notes += ' Wi-Fi-only preference and explicit unknown-network handling pass focused tests; native resume invalidates stale connection types and policy changes stop transfers. Current PWA and Android/dev include storage and Wi-Fi controls, with native device/iOS/full-criterion acceptance still open.';
}
const globeStage = state.stages.find(stage => stage.id === 'S06');
globeStage.artifacts.push(folder + '/globe-a1/result.json');
globeStage.criteria.find(item => item.id === 'S06.PERF-008').notes += ' Interrupted drag recovery fixed in 7f6f2802 and checked in actual Chrome with injected native lifecycle; physical-device listener stability remains open.';
assert.deepEqual(state.stages.map(stage => [stage.id, stage.status]), statuses);
await fs.writeFile(stateFile, json(state));
const note = `<!-- s11-wifi-policy-20260919:begin -->
S11 Wi-Fi-only preference, truthful network types and interrupted globe-gesture recovery
are validated from source 7f6f2802: 279 focused unit cases, 6 actual Chrome cases,
final TypeScript and platform-boundary checks passed. Unknown network types cannot
start Wi-Fi-only transfers; native resume clears stale Wi-Fi and continuation is explicit.
RU/EN preference survives cold offline PWA launch; narrow-screen screenshots inspected.
Evidence: evidence/S11/wifi-policy-20260919/result.json.
Current PWA d1e90c35 and Android/dev b2f77958 include storage, lifecycle and Wi-Fi controls.
Exact artifacts and previous versions are preserved on D: under s11-wifi / s11-storage.
Android APK: 67,587,888 bytes; SHA256 0ace08af7357924e4348ee8044b0b64b9eca63a499eb9a3fed37d2bd736a4f06.
Runtime identity/binary checks passed; native installed-device/process-death execution and
iOS compilation remain open. Only S00-S02 accepted; S03 is first open, releaseReady false.
Next: separately authorized saved optional-package uninstall, with mandatory bootstrap
protection and safe concurrent-update handling. QA content remains inactive; production
descriptors/trust empty. D107 final owner archive sync and external release gates remain.
<!-- s11-wifi-policy-20260919:end -->

`;
for (const file of ['docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt']) {
  const old = await fs.readFile(file, 'utf8'); assert.ok(!old.includes('s11-wifi-policy-20260919:begin'));
  await fs.writeFile(file, note + old);
}
await fs.appendFile('docs/mobile/DECISIONS.md', `
- D121: Wi-Fi-only is a persistent non-secret download intent, enabled by default in
  real adapters and enforced only from explicit fresh platform network types. Browser
  throughput/effectiveType is not Wi-Fi evidence. Bounded preference IO remains usable
  on failure and late writes are ordered; foreground network recovery never starts a
  transfer automatically. Source 7f6f2802 also repairs manual globe gestures interrupted
  by native backgrounding. 279 focused units and 6 actual Chrome cases pass; current
  PWA d1e90c35 and Android/dev b2f77958 are source-bound and exactly preserved. The
  type-only Navigator correction and LF normalization preserve emitted JavaScript;
  passing runtime suites were reused. Native/iOS/stage/release gates remain open.
  Continue S11 saved optional-package uninstall without weakening bootstrap protection.
`);
console.log(json({ pass: true, sourceCommit, passingUnitCases: 279, actualChromeCases: 6,
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, stageStatusesUnchanged: true, releaseReady: false }));
