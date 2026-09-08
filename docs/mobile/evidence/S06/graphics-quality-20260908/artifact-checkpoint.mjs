import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateExecution } from '../../scripts/mobile/state.mjs';
import { parseCsv } from '../../scripts/mobile/csv.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S06/graphics-quality-20260908`;
const androidPath = `${base}/evidence/S04/graphics-profiles-android-20260908/result.json`;
const pwaPath = `${base}/evidence/S03/graphics-quality-20260908/pwa/result.json`;
const sourceCommit = '632a60c36ce117e210010da1ab77432280f5fa10';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/u, ''));
const gitHead = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(gitHead, sourceCommit);
const [android, pwa, original, browser] = await Promise.all([read(androidPath), read(pwaPath), read(`${evidence}/result.json`), read(`${evidence}/browser/result.json`)]);
assert.equal(android.sourceCommit, sourceCommit); assert.equal(pwa.sourceCommit, sourceCommit);
assert.equal(android.status, 'BUILD_AND_BINARY_INSPECTION_PASSED');
assert.equal(android.validation.build.pass, true); assert.equal(android.validation.build.offline, true);
assert.equal(android.validation.binaryAudit.pass, true); assert.equal(android.validation.nativeStrictAudit.pass, true);
assert.equal(pwa.strictArtifactAuditPassed, true); assert.equal(pwa.sourceUnchanged, true);
assert.equal(pwa.status, 'LOCAL_QA_PWA_BUILD_AUDIT_AND_AFFECTED_BROWSER_PASSED');
assert.equal(pwa.browserExecutions, 1); assert.equal(pwa.statistics.expected, 1); assert.equal(pwa.statistics.unexpected, 0);
const nativeBytes = await fs.readFile(`${android.artifact.path}/artifact.json`), pwaBytes = await fs.readFile(`${pwa.artifact.path}/artifact.json`);
assert.equal(sha(nativeBytes), android.artifact.sha256); assert.equal(sha(pwaBytes), pwa.artifact.artifactSha256);
const nativeArtifact = JSON.parse(nativeBytes), pwaArtifact = JSON.parse(pwaBytes);
assert.equal(nativeArtifact.sourceInputs.sha256, browser.sourceInputsSha256);
const sourceFiles = new Map();
for (const file of [...nativeArtifact.sourceInputs.files, ...pwaArtifact.sourceInputs.files, ...original.sourceFiles]) {
  if (sourceFiles.has(file.path)) assert.equal(sourceFiles.get(file.path), file.sha256, file.path);
  sourceFiles.set(file.path, file.sha256);
}
for (const [file, digest] of sourceFiles) assert.equal(sha(await fs.readFile(file)), digest, file);
for (const file of [...android.reports, ...android.transcripts, ...pwa.preservedFiles]) {
  const bytes = await fs.readFile(file.path); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha(bytes), file.sha256, file.path);
}
const apk = await fs.readFile(android.apk.path); assert.equal(apk.length, android.apk.bytes); assert.equal(sha(apk), android.apk.sha256);
assert.equal((await read(android.validation.preservedCopies)).pass, true); assert.equal(pwa.artifact.exactCopiesVerified, true);
const nativePortraits = nativeArtifact.inventory.filter(file => file.path.startsWith('assets/writer-portraits/'));
const pwaPortraits = pwaArtifact.inventory.filter(file => file.path.startsWith('assets/writer-portraits/'));
assert.equal(nativePortraits.length, 1011); assert.equal(pwaPortraits.length, 1011);
assert.deepEqual(nativePortraits.map(file => [file.path, file.sha256]).sort(), pwaPortraits.map(file => [file.path, file.sha256]).sort());
const state = await read(`${base}/AUTOPILOT_STATE.json`), cache = state.verificationCache;
const protectedValue = () => JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, ...stage }) => stage), ios: cache.s04IosGlobeProjection, journey: cache.s05FirstJourney });
const protectedBefore = protectedValue(); assert.equal(state.currentCriterionId, 'S03.acceptance');
const priorBytes = await fs.readFile(`${evidence}/result.json`); assert.equal(sha(priorBytes), cache.s06GraphicsQuality.sha256);
await fs.writeFile(`${evidence}/source-result.json`, priorBytes, { flag: 'wx' });
const recordedAt = new Date().toISOString();
const checkpoint = { schemaVersion: 1, recordedAt, sourceCommit, sourceInputsCurrent: true,
  sourceInputCounts: { android: nativeArtifact.sourceInputs.files.length, pwa: pwaArtifact.sourceInputs.files.length, uniqueVerifiedIncludingFocusedTests: sourceFiles.size },
  android: { evidence: androidPath, sha256: sha(await fs.readFile(androidPath)), buildId: android.buildId, sourceInputsSha256: nativeArtifact.sourceInputs.sha256,
    runtime: android.artifact.path, apk: android.apk, strictAudit: true, binaryAudit: true, copiesVerified: true, installedRuntimeTested: false },
  pwa: { evidence: pwaPath, sha256: sha(await fs.readFile(pwaPath)), buildId: pwa.buildId, sourceInputsSha256: pwaArtifact.sourceInputs.sha256,
    runtime: pwa.artifact.path, artifactSha256: pwa.artifact.artifactSha256, files: pwa.artifact.files, bytes: pwa.artifact.bytes, strictAudit: true, copiesVerified: true,
    localQaAuthority: true, browserExecutions: 1, browserPassed: true, physicalDeviceTested: false },
  sourceBrowser: { evidence: `${evidence}/browser/result.json`, passed: 1, sameNativeSourceInputs: true, nativePluginsSimulated: true },
  portraitParity: { filesPerArtifact: 1011, exactSameBytes: true, newArtOrRightsApprovals: 0 },
  acceptanceStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.writeFile(`${evidence}/artifact-checkpoint.json`, json(checkpoint), { flag: 'wx' });
const result = { ...original, recordedAt, sourceCommit, status: 'SOURCE_AND_LOCAL_ARTIFACT_VALIDATION_PASSED',
  sourceCheckpointEvidence: 'source-result.json', sourceCheckpointSha256: sha(priorBytes),
  artifactCheckpointEvidence: 'artifact-checkpoint.json', artifactCheckpointSha256: sha(await fs.readFile(`${evidence}/artifact-checkpoint.json`)),
  newNativeArtifactProduced: true, newPwaArtifactProduced: true, nativeArtifactEvidence: androidPath, pwaArtifactEvidence: pwaPath,
  nativeBuildId: android.buildId, pwaBuildId: pwa.buildId,
  artifactRuntimeLimit: 'Actual built PWA desktop offline case plus audited Android/dev APK and source-browser behavior; no installed Android/iOS or exact release candidate.' };
const resultBytes = Buffer.from(json(result));
Object.assign(cache.s06GraphicsQuality, { status: result.status, sha256: sha(resultBytes), sourceCommit, sourceInputsCurrent: true,
  nativeArtifact: checkpoint.android, pwaArtifact: checkpoint.pwa, newNativeArtifactProduced: true, newPwaArtifactProduced: true });
Object.assign(cache.s03CanonicalPortraits, { sourceCommit, nativeBuildPending: false, pwaBuildPending: false, nativeArtifact: checkpoint.android,
  pwaArtifact: checkpoint.pwa, portraitParity: checkpoint.portraitParity, actualPwaOfflineBrowserPassed: true });
const globe = cache.s04GlobeApplication;
globe.nativeArtifactHistory.push({ evidence: globe.nativeArtifactEvidence, artifact: structuredClone(globe.nativeArtifact) });
Object.assign(globe, { nativeArtifactCurrentSource: true, nativeArtifactRefreshed: true, nativeArtifactEvidence: androidPath,
  nativeArtifact: { platform: 'android', channel: 'dev', sourceCommit, buildId: android.buildId, sourceInputsSha256: nativeArtifact.sourceInputs.sha256,
    runtime: android.artifact.path, apk: android.apk, nativeStrictAudit: true, offlineGradleBuild: true, apkBinaryAudit: true, preservationCopiesVerified: true,
    currentSource: true, runtimeEquivalentToCurrentSource: true, validatedAgainstSourceCommit: sourceCommit, buildCommitEqualsValidatedSourceCommit: true,
    includesS05FirstJourney: true, includesNativeActivity: true, includesCountrySheetGestures: true, includesRichDefaultAndEditionAppearance: true,
    includesBiographyReviewAndStaleGate: true, includesSavedGraphicsProfiles: true, canonicalPortraitFiles: 1011,
    installedRuntimeTested: false, exactReleaseCandidate: false, stageAccepted: false, releaseReady: false } });
for (const [id, file] of [['S03', pwaPath], ['S04', androidPath], ['S06', `${evidence}/artifact-checkpoint.json`]]) {
  const stage = state.stages.find(stage => stage.id === id); stage.artifacts = [...new Set([...stage.artifacts, file])];
}
state.updatedAt = recordedAt;
state.resume.nextAction = `Continue routed open stages from source${sourceCommit.slice(0,8)}. Saved High/Balanced/Economy has122 focused tests, final static, native source-browser1PASS and actual built-PWA expanded portrait/offline/quality/RUEN1PASS. Android${android.buildId.slice(0,8)}/PWA${pwa.buildId.slice(0,8)} include identical1011 existing portraits. Do not replay green suites. S03 remains first-open; English coverage, nearly10k catalog, EN edition covers/owner workflow, Planetka/full3D tiers, physical devices and release gates remain open. Frozen iOS83 unchanged/pending.`;
assert.equal(protectedValue(), protectedBefore);
const structural = validateExecution({ state, traceability: await read(`${base}/REQUIREMENTS_TRACEABILITY.json`), mapping: await read(`${base}/STAGE_REQUIREMENT_MAP.json`), sources: parseCsv(await fs.readFile(`${base}/requirements/v12/68_REQUIREMENT_ID_INDEX.csv`, 'utf8')), stageDefinitions: parseCsv(await fs.readFile(`${base}/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv`, 'utf8')), schemas: { state: await read(`${base}/requirements/v12/43_AUTOPILOT_STATE_SCHEMA.json`), traceability: await read(`${base}/requirements/v12/57_REQUIREMENTS_TRACEABILITY_SCHEMA.json`) } });
assert.equal(structural.pass, true, JSON.stringify(structural.errors)); assert.equal(structural.releaseReady, false);
await fs.writeFile(`${evidence}/final-state-structure.json`, json({ ...structural, acceptanceStateUnchanged: true, fullEvidenceCheck: 'source-state-verification.json' }), { flag: 'wx' });
const block = `<!-- s06-graphics-quality:begin -->\nSource ${sourceCommit}: saved High/Balanced/Economy, defaultHigh.\nSame Canvas/renderer/camera/country/writer; RU/EN, reduced motion and\n320px/200% text/keyboard/return behavior source-validated.\n122 unique focused tests and final TypeScript/platform boundaries passed.\nNative source-browser1PASS; actual built-PWA offline/portraits/quality/RUEN1PASS.\nAndroid/dev ${android.buildId.slice(0,8)}: strict audit, offline Gradle, APK bytes/signature/alignment.\nAPK: ${android.apk.path}.\nControlled local-QA PWA ${pwa.buildId.slice(0,8)}: strict audit, real worker/cache browser and exact archive.\nBoth builds contain identical1011 existing canonical portrait files.\nEvidence: evidence/S06/graphics-quality-20260908/result.json.\nS03 remains first-open; S06 in progress. No installed device or RC acceptance.\nFull English content, nearly10k/edition cover owner workflows, Planetka/3D\nasset tiers and device/store/legal/release gates remain open.\nFrozen iOS83 unchanged/pending. Earlier blocks below are historical snapshots.\n<!-- s06-graphics-quality:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = `${base}/${name}`, text = (await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n'); assert.ok(text.includes('<!-- s06-graphics-quality:begin -->'));
  await fs.writeFile(file, text.replace(/<!-- s06-graphics-quality:begin -->[\s\S]*?<!-- s06-graphics-quality:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n'); assert.ok(!/^- D090:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + `\n\n- D090: Source${sourceCommit.slice(0,8)} is compiled as Android/dev${android.buildId.slice(0,8)}\n  and local-QA PWA${pwa.buildId.slice(0,8)}. Exact portrait parity, strict build/source\n  checks and preservation passed. The PWA has one actual built-runtime\n  expanded offline/quality/RUEN browser case; Android has APK byte/signature\n  checks plus separate native-source browser evidence. Keep these boundaries\n  distinct from installed devices, human review, frozen iOS83 or release.\n`);
await fs.writeFile(`${evidence}/result.json`, resultBytes); await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
await fs.writeFile(`${evidence}/artifact-checkpoint.mjs`, await fs.readFile(new URL(import.meta.url)), { flag: 'wx' });
console.log(json({ evidence: `${evidence}/result.json`, sourceCommit, nativeBuildId: android.buildId, pwaBuildId: pwa.buildId,
  uniqueSourceInputsVerified: sourceFiles.size, portraitParity: checkpoint.portraitParity, stageAccepted: false, releaseReady: false }));
