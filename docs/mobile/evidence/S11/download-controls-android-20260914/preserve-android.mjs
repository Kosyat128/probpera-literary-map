import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = 'docs/mobile/evidence/S11/download-controls-android-20260914';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceCommit = 'aadc0f7f2cc8ea150f95c3b1bf8c156464b4aac8';
assert.equal(execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const build = await read(out + '/build-run.json'), binary = await read(out + '/android-dev-apk-verification.json'), audit = await read(out + '/native-artifact-audit.json');
const artifactBytes = await fs.readFile('dist-native/artifact.json'), artifact = JSON.parse(artifactBytes);
for (const record of [build, binary, audit]) assert.equal(record.pass, true);
assert.equal(artifact.sourceCommit, sourceCommit); assert.equal(build.sourceCommit, sourceCommit);
assert.equal(binary.sourceArtifact.buildId, artifact.buildId); assert.equal(audit.identity.buildId, artifact.buildId);
assert.equal(binary.sourceArtifact.sha256, sha(artifactBytes)); assert.ok(binary.dex.localContentStore.dex);
for (const file of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
const nativePaths = execFileSync('git', ['-c', 'safe.directory=' + root, 'ls-files', '-z', '--', 'apps/mobile/android'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const nativeSourceInputs = await Promise.all(nativePaths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const destinationRoot = 'D:/CodexData/.codex/visualizations/2026/09/04/01a06dd0-30ba-7fe1-9637-858d87ac1ff5';
assert.equal((await fs.realpath(destinationRoot)).replaceAll('\\', '/'), destinationRoot);
const destination = destinationRoot + '/lpv12-' + artifact.buildId.slice(0, 8);
assert.ok(destination.startsWith(destinationRoot + '/')); await fs.mkdir(destination);
await fs.mkdir(destination + '/runtime');
const copies = [];
async function copy(source, target, expected) {
 const sourceInfo = await fs.lstat(source); assert.equal(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), true);
 const bytes = await fs.readFile(source); if (expected) { assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256); }
 assert.ok(target.startsWith(destination + '/') || target.startsWith(out + '/'));
 await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes, { flag: 'wx' });
 const copied = await fs.readFile(target); assert.ok(bytes.equals(copied));
 const receipt = { source, path: target, bytes: bytes.length, sha256: sha(bytes) }; copies.push(receipt); return receipt;
}
for (const file of artifact.inventory) {
 assert.ok(file.path && !file.path.split('/').includes('..') && !path.isAbsolute(file.path) && !file.path.includes('\\'));
 await copy('dist-native/' + file.path, destination + '/runtime/' + file.path, file);
}
const metadata = await copy('dist-native/artifact.json', destination + '/runtime/artifact.json', { bytes: artifactBytes.length, sha256: sha(artifactBytes) });
const apk = await copy(binary.apk.path, destination + '/app-dev-debug.apk', binary.apk);
await copy('dist-native/artifact.json', out + '/native-artifact.json');
for (const name of ['build-android.ps1', 'prepare-android.mjs', 'verify-android.mjs', 'preserve-android.mjs']) await copy('.tmp/s11-download-controls-20260914/' + name, out + '/' + name);
const copied = { pass: true, files: copies.length, copies }; await fs.writeFile(out + '/copy-verification.json', json(copied), { flag: 'wx' });
const recordedAt = new Date().toISOString();
const next = 'Continue S11 native storage execution/recovery and app pause/resume handling using the committed download controls. Android dev APK a83dfcd6 is preserved with exact source/runtime/binary proofs, but has no installed-device evidence; iOS source requires authorized macOS compilation and native capability checks. Refresh the PWA artifact after the next S11 integration slice, reusing passed source/Chrome evidence when unchanged. Keep QA candidates inactive. D107 final owner archive synchronization follows app implementation; no factual filling, store/deploy/merge or public CI upload.';
const result = { schemaVersion: 1, recordedAt, kind: 'android-download-controls-dev-apk-preservation', stage: 'S11',
 status: 'BUILD_AND_ACTUAL_BINARY_INSPECTION_PASSED', sourceCommit, buildId: artifact.buildId,
 sourceInputsSha256: artifact.sourceInputs.sha256, nativeSourceInputs,
 artifact: { path: destination + '/runtime', metadata: out + '/native-artifact.json', sha256: metadata.sha256 },
 apk: { path: apk.path, bytes: apk.bytes, sha256: apk.sha256 },
 validation: { sourceBehavior: 'docs/mobile/evidence/S11/download-controls-20260914/result.json',
   strictRuntime: out + '/native-artifact-audit.json', build: out + '/build-run.json', binaryAudit: out + '/android-dev-apk-verification.json',
   copiedBytes: out + '/copy-verification.json', localContentStoreDex: binary.dex.localContentStore.dex,
   bundledAssetsMatched: binary.bundledAssets.matched, nativeBridgePackageMatched: true, nativeLocales: ['en', 'ru'] },
 nativeExecutionVerified: false, iosCompiled: false, sourceScreenshotsAreExactRc: false, stageAccepted: false,
 releaseReady: false, productionActionsPerformed: false, canonicalOwnerArchiveSyncPerformed: false,
 priorAndroidPreserved: 'docs/mobile/evidence/S04/archive-search-android-20260914/result.json',
 pwaArtifactUnchanged: '0381b95fa2b6de6e0dd1340b28d885c496cb7ff6f6bca72d6e0cc1e0cf632354', nextAction: next };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(statePath);
const protection = value => json({ headSha: value.headSha, currentStageId: value.currentStageId, currentCriterionId: value.currentCriterionId,
 stages: value.stages.map(stage => ({ id: stage.id, status: stage.status, criteria: stage.criteria.map(item => ({ id: item.id, status: item.status, commit: item.commit })) })) });
const before = protection(state); assert.equal(state.currentCriterionId, 'S03.acceptance');
const stage = state.stages.find(stage => stage.id === 'S11'); stage.artifacts = [...new Set([...stage.artifacts, out + '/result.json'])];
stage.lastGreenCommands = [...new Set([...stage.lastGreenCommands, '.tmp/s11-download-controls-20260914/build-android.ps1', '.tmp/s11-download-controls-20260914/preserve-android.mjs'])];
state.verificationCache.s11DownloadControls.androidArtifact = out + '/result.json';
state.verificationCache.s11AndroidDownloads = { status: result.status, evidence: out + '/result.json', sha256: sha(json(result)), sourceCommit,
 buildId: artifact.buildId, apk: result.apk, runtime: result.artifact.path, stageAccepted: false, deviceTested: false, releaseReady: false };
state.updatedAt = recordedAt; state.resume.nextAction = next; state.resume.contextFiles = [...new Set([...state.resume.contextFiles, out + '/result.json'])];
assert.equal(protection(state), before); await fs.writeFile(statePath, json(state));
const marker = 's11-download-controls-android-20260914';
const block = '<!-- ' + marker + ':begin -->\nAndroid/dev a83dfcd6 built from committed source aadc0f7f2cc8ea150f95c3b1bf8c156464b4aac8.\nStrict runtime audit, actual APK ZIP/CRC/resource equality, RUEN locales, debug signature,\nalignment and native DEX class checks passed. New PlanetContentStorePlugin is in classes10.dex.\n216 source unit cases and 4 Chrome cases remain valid; no unchanged suite was rerun for packaging.\nAPK and runtime are preserved with exact copy hashes on D: under lpv12-a83dfcd6.\nEvidence: evidence/S11/download-controls-android-20260914/result.json. This is a dev APK,\nnot installed-device, iOS, paid-content, store or RC acceptance. PWA0381b95f and prior\nAndroid048c8e1b/frozen iOS83 remain preserved. Next: native execution/pause/recovery; then\na refreshed PWA artifact. First-open S03 and D107 deferred final owner archive sync remain.\n<!-- ' + marker + ':end -->\n\n';
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
 const file = 'docs/mobile/' + name, text = await fs.readFile(file, 'utf8'); assert.ok(!text.includes(marker)); await fs.writeFile(file, block + text);
}
const decisionPath = 'docs/mobile/DECISIONS.md', decisions = await fs.readFile(decisionPath, 'utf8'); assert.ok(!/^- D117:/mu.test(decisions));
await fs.writeFile(decisionPath, decisions.trimEnd() + '\n\n- D117: Build one combined Android/dev APK for S11 download controls and native\n  private storage from source aadc0f7f. Strict runtime and actual APK checks bind\n  a83dfcd6 to that source; DEX includes the locally registered store and AndroidX\n  atomic file implementation. Preserve exact APK/runtime copies on the authorized\n  D: workspace to limit C: usage. No unchanged source/browser suites were repeated\n  for packaging. Installed native execution, iOS compilation, content approval and\n  all stage/release gates remain open; D107 final owner archives stay deferred.\n');
const verification = await verifyExecutionFiles(root); await fs.writeFile(out + '/state-verification.json', json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, json(verification.errors));
console.log(json({ pass: true, sourceCommit, buildId: artifact.buildId, apk: result.apk, preservedFiles: copies.length, firstOpen: state.currentCriterionId }));
