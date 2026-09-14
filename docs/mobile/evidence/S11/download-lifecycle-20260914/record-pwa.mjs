import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const folder = 'docs/mobile/evidence/S11/download-lifecycle-20260914', resultPath = folder + '/pwa-a1/result.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const result = JSON.parse(await fs.readFile(resultPath, 'utf8')); assert.equal(result.pass, true);
assert.equal(result.artifact.exactCopiesVerified, true);
const images = [];
for (const locale of ['ru', 'en']) {
 const file = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11/pwa-a1/downloads-artifact-built-P-ba6df-ter-cold-offline-navigation/pwa-downloads-' + locale + '.png';
 const bytes = await fs.readFile(file); images.push({ path: file, bytes: bytes.length, sha256: sha(bytes), viewedAtOriginalResolution: true });
}
const recordedAt = new Date().toISOString();
await fs.writeFile(folder + '/pwa-a1/visual-review.json', json({ schemaVersion: 1, recordedAt, buildId: result.buildId, images, pass: true,
  scope: 'Actual built PWA in Chrome, 390x844, after cold offline RU and EN navigation.',
  observations: ['The existing collection header, locale selector and close control remain visible.',
    'Localized download disclosure and empty catalog wrap cleanly within the panel; scene ownership is verified separately by browser assertions.',
    'The saved access/offline notices remain distinct from download availability.'],
  stageAccepted: false, releaseReady: false }), { flag: 'wx' });
const supportFiles = ['tests/pwa/downloads-artifact.spec.mjs', folder + '/pwa.config.mjs', folder + '/run-pwa.mjs',
  'tests/pwa/support/local-server.mjs', 'scripts/mobile/verify-pwa-artifact.mjs'];
await fs.writeFile(folder + '/pwa-a1/support-inputs.json', json({ recordedAt, capturedAfterRun: true,
  files: await Promise.all(supportFiles.map(async path => ({ path, sha256: sha(await fs.readFile(path)) }))) }), { flag: 'wx' });
const logBytes = await fs.readFile(folder + '/pwa-run.log');
await fs.writeFile(folder + '/pwa-a1/build-session-log.json', json({ recordedAt, originalSha256: sha(logBytes),
  text: logBytes.toString('utf8'), note: 'One combined local build/audit/browser/preservation run. Full build retains its ordinary chunk-size warnings.' }), { flag: 'wx' });
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = JSON.parse(await fs.readFile(statePath, 'utf8'));
state.updatedAt = recordedAt;
state.verificationCache.s11LifecyclePwa = { status: 'BUILD_STRICT_AUDIT_OFFLINE_BROWSER_AND_EXACT_PRESERVATION_PASSED',
  evidence: resultPath, sha256: sha(await fs.readFile(resultPath)), sourceCommit: result.sourceCommit, buildId: result.buildId,
  artifact: result.artifact, browserPassed: true, actualChromeCases: 1, localQaAuthority: true, stageAccepted: false, releaseReady: false };
state.verificationCache.s11DownloadLifecycle.sourceCommit = result.sourceCommit;
state.verificationCache.s11DownloadLifecycle.pwaArtifact = resultPath;
const stage = state.stages.find(item => item.id === 'S11');
stage.artifacts.push(resultPath);
stage.lastGreenCommands.push('node ' + folder + '/run-pwa.mjs ' + result.sourceCommit);
state.resume.nextAction = 'Continue S11 storage management: bounded free-space reporting and optional package removal with protected bootstrap/current/previous generations, following document18 and the existing native/cache ports. Native filesystem execution/process-death recovery remains unverified: ADB lists no devices and no emulator is installed; do not treat injected Chrome events as native execution. Reuse current 226 source units, 4 source browser cases and the c6c50755 actual PWA case when inputs remain unchanged. Android a83dfcd6 predates the latest lifecycle source; refresh only after the next native-relevant slice. Keep QA candidates inactive and D107 final owner archive synchronization deferred. No public CI upload, deploy, merge or store action.';
state.resume.contextFiles.push(resultPath);
await fs.writeFile(statePath, json(state));
const note = `<!-- s11-lifecycle-pwa-20260914:begin -->\nSource06d8e852 produced local-QA PWA c6c50755. Strict artifact audit and actual\ncold offline RUEN download-panel navigation passed with the same canonical globe,\nCanvas, renderer, camera and scene. Exact1422-file/74,221,368B copy is preserved on D:\n${result.artifact.path}\nArtifact SHA256:${result.artifact.artifactSha256}\nEvidence: evidence/S11/download-lifecycle-20260914/pwa-a1/result.json. One new actual\nartifact case supplements226 source units and4 source-browser cases, without replaying\nunchanged source suites. Both original-resolution artifact screenshots were inspected.\nNext: S11 free-space/optional-package storage controls and protected generation pruning.\nNative device/process-death checks stay open; ADB lists no devices, emulator absent.\nAndroid a83dfcd6 still predates this lifecycle source; frozen iOS83 is unchanged.\nFirst-open S03, QA activation, D107 final archives and stage/release gates remain open.\n<!-- s11-lifecycle-pwa-20260914:end -->\n\n`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
 const file = 'docs/mobile/' + name; await fs.writeFile(file, note + await fs.readFile(file, 'utf8'));
}
const decisionPath = 'docs/mobile/DECISIONS.md';
await fs.writeFile(decisionPath, (await fs.readFile(decisionPath, 'utf8')).replaceAll('\r\n', '\n') +
 '\n- D119: Preserve one refreshed local-QA PWA c6c50755 from committed lifecycle\n  source06d8e852. Strict current-source/hash audit, actual cold offline RUEN\n  downloads/globe browser case and1422 exact copied files pass. Source226/4\n  validation is reused. Android a83dfcd6 and frozen iOS83 retain their older\n  source identities. Native device/process-death gates remain open; proceed\n  with internal S11 storage management under document18. D107 final owner\n  archive synchronization and all stage/release gates remain unchanged.\n');
// Normalize the readable ADB transcript; original CRLF bytes remain in source commit06d8e852.
const adbPath = folder + '/adb-devices.txt';
await fs.writeFile(adbPath, (await fs.readFile(adbPath, 'utf8')).replaceAll('\r\n', '\n').trimEnd() + '\n');
console.log(json({ checkpointUpdated: true, sourceCommit: result.sourceCommit, pwaBuildId: result.buildId, stageAccepted: false }));
