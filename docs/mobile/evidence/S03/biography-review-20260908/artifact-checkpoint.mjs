import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { validateExecution } from '../../scripts/mobile/state.mjs';
import { parseCsv } from '../../scripts/mobile/csv.mjs';

const base = 'docs/mobile', evidence = `${base}/evidence/S03/biography-review-20260908`;
const androidEvidence = `${base}/evidence/S04/biography-review-android-20260908/result.json`;
const pwaEvidence = `${evidence}/pwa/result.json`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async name => JSON.parse((await fs.readFile(name, 'utf8')).replace(/^\uFEFF/u, ''));
const sourceCommit = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(sourceCommit, '308d8366c24f8b9f47ada304b43856c327890d43');
const [android, pwa, sourceResult, browser] = await Promise.all([read(androidEvidence), read(pwaEvidence), read(`${evidence}/result.json`), read(`${evidence}/browser/result.json`)]);
assert.equal(android.sourceCommit, sourceCommit); assert.equal(pwa.sourceCommit, sourceCommit);
assert.equal(android.status, 'BUILD_AND_BINARY_INSPECTION_PASSED');
assert.equal(pwa.strictArtifactAuditPassed, true); assert.equal(pwa.sourceUnchanged, true);
assert.equal(pwa.browserExecutions, 0); assert.equal(pwa.browserTestsRun, false);
assert.equal(android.validation.build.pass, true); assert.equal(android.validation.build.offline, true);
assert.equal(android.validation.binaryAudit.pass, true);
assert.equal(android.validation.nativeStrictAudit.pass, true);
const nativeArtifactBytes = await fs.readFile(`${android.artifact.path}/artifact.json`);
const pwaArtifactBytes = await fs.readFile(`${pwa.artifact.path}/artifact.json`);
assert.equal(sha(nativeArtifactBytes), android.artifact.sha256);
assert.equal(sha(pwaArtifactBytes), pwa.artifact.artifactSha256);
const nativeArtifact = JSON.parse(nativeArtifactBytes), pwaArtifact = JSON.parse(pwaArtifactBytes);
assert.equal(nativeArtifact.buildId, android.buildId); assert.equal(pwaArtifact.buildId, pwa.buildId);
assert.equal(nativeArtifact.sourceInputs.sha256, browser.sourceInputsSha256);
const files = new Map();
for (const file of [...nativeArtifact.sourceInputs.files, ...pwaArtifact.sourceInputs.files, ...sourceResult.sourceFiles]) {
  if (files.has(file.path)) assert.equal(files.get(file.path), file.sha256, file.path);
  files.set(file.path, file.sha256);
}
for (const [path, expected] of files) assert.equal(sha(await fs.readFile(path)), expected, path);
for (const file of [...android.reports, ...android.transcripts, ...pwa.preservedFiles]) {
  const bytes = await fs.readFile(file.path); assert.equal(sha(bytes), file.sha256, file.path); assert.equal(bytes.length, file.bytes, file.path);
}
const apk = await fs.readFile(android.apk.path); assert.equal(apk.length, android.apk.bytes); assert.equal(sha(apk), android.apk.sha256);
const nativeCopy = await read(android.validation.preservedCopies); assert.equal(nativeCopy.pass, true);
assert.equal(nativeCopy.buildId, android.buildId); assert.equal(pwa.artifact.exactCopiesVerified, true);

const names = ['AUTOPILOT_STATE.json', 'STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md', 'DECISIONS.md'];
const before = new Map(await Promise.all(names.map(async name => [name, await fs.readFile(`${base}/${name}`, 'utf8')])));
const state = JSON.parse(before.get(names[0])), cache = state.verificationCache;
const protectedValue = () => JSON.stringify({ stages: state.stages.map(({ artifacts, ...rest }) => rest), head: state.headSha,
  ios: cache.s04IosGlobeProjection, firstJourney: cache.s05FirstJourney, activity: cache.s04NativeActivity, oldPwa: cache.s03DevicePreparation });
const protectedBefore = protectedValue(); assert.equal(state.currentCriterionId, 'S03.acceptance');
const priorBytes = await fs.readFile(`${evidence}/result.json`);
assert.equal(sha(priorBytes), cache.s03BiographyReview.sha256);
await fs.writeFile(`${evidence}/source-result.json`, priorBytes, { flag: 'wx' });
const recordedAt = new Date().toISOString();
const checkpoint = { schemaVersion: 1, recordedAt, sourceCommit, sourceInputsCurrent: true,
  sourceInputCounts: { android: nativeArtifact.sourceInputs.files.length, pwa: pwaArtifact.sourceInputs.files.length, uniqueVerifiedIncludingFocusedTests: files.size },
  android: { evidence: androidEvidence, sha256: sha(await fs.readFile(androidEvidence)), buildId: android.buildId, sourceInputsSha256: nativeArtifact.sourceInputs.sha256,
    runtime: android.artifact.path, apk: android.apk, strictAudit: true, binaryAudit: true, copiesVerified: true, installedRuntimeTested: false },
  pwa: { evidence: pwaEvidence, sha256: sha(await fs.readFile(pwaEvidence)), buildId: pwa.buildId, sourceInputsSha256: pwaArtifact.sourceInputs.sha256,
    runtime: pwa.artifact.path, artifactSha256: pwa.artifact.artifactSha256, files: pwa.artifact.files, bytes: pwa.artifact.bytes, strictAudit: true, copiesVerified: true,
    localQaAuthority: true, browserExecutions: 0 },
  browser: { evidence: `${evidence}/browser/result.json`, passes: 1, sameNativeSourceInputSnapshot: true, nativePluginsSimulated: true, exactArtifactRuntime: false },
  acceptanceStateUnchanged: true, stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.writeFile(`${evidence}/artifact-checkpoint.json`, json(checkpoint), { flag: 'wx' });
const result = { ...sourceResult, recordedAt, sourceCommit, status: 'SOURCE_AND_LOCAL_ARTIFACT_VALIDATION_PASSED',
  sourceCheckpointEvidence: 'source-result.json', sourceCheckpointSha256: sha(priorBytes),
  artifactCheckpointEvidence: 'artifact-checkpoint.json', artifactCheckpointSha256: sha(await fs.readFile(`${evidence}/artifact-checkpoint.json`)),
  newNativeArtifactProduced: true, newPwaArtifactProduced: true, nativeArtifactEvidence: androidEvidence, pwaArtifactEvidence: pwaEvidence,
  nativeBuildId: android.buildId, pwaBuildId: pwa.buildId,
  artifactRuntimeLimit: 'One source/browser scenario with injected OS APIs plus exact native/PWA build audits; no installed APK or fresh PWA browser suite.' };
const resultBytes = Buffer.from(json(result));
Object.assign(cache.s03BiographyReview, { evidence: `${evidence}/result.json`, sha256: sha(resultBytes), status: result.status, sourceCommit,
  newNativeArtifactProduced: true, newPwaArtifactProduced: true, sourceInputsCurrent: true,
  nativeArtifact: checkpoint.android, pwaArtifact: checkpoint.pwa,
  corpus: { ru: 1684, en: 20, existingProfilesRetained: true, actualTranslatedApprovals: 0, fullCoverageCertified: false } });
const globe = cache.s04GlobeApplication;
globe.nativeArtifactHistory.push({ evidence: globe.nativeArtifactEvidence, artifact: structuredClone(globe.nativeArtifact) });
Object.assign(globe, { nativeArtifactCurrentSource: true, nativeArtifactRefreshed: true, nativeArtifactEvidence: androidEvidence,
  nativeArtifact: { platform: 'android', channel: 'dev', sourceCommit, buildId: android.buildId, sourceInputsSha256: nativeArtifact.sourceInputs.sha256,
    runtime: android.artifact.path, apk: android.apk, nativeStrictAudit: true, offlineGradleBuild: true, apkBinaryAudit: true,
    preservationCopiesVerified: true, currentSource: true, runtimeEquivalentToCurrentSource: true, validatedAgainstSourceCommit: sourceCommit, buildCommitEqualsValidatedSourceCommit: true,
    includesS05FirstJourney: true, includesNativeActivity: true, includesCountrySheetGestures: true, includesRichDefaultAndEditionAppearance: true,
    includesBiographyReviewAndStaleGate: true, installedRuntimeTested: false, exactReleaseCandidate: false, stageAccepted: false, releaseReady: false } });
// Preserve the earlier repair/appearance browser receipts with their actual
// source identity; the new PWA has a strict build audit and zero browser runs.
assert.equal(cache.s03OfflineRepair.currentSource, false);
for (const [id, file] of [['S03', pwaEvidence], ['S04', androidEvidence]]) {
  const stage = state.stages.find(item => item.id === id); stage.artifacts = [...new Set([...stage.artifacts, file])];
}
state.updatedAt = recordedAt;
state.resume.nextAction = 'Continue routed S03 outstanding access/offline/localization gates from source308d8366. Biography review/stale gate has138 focused tests, joint static, one actual RU/EN writer/globe source-browser case, all1684RU/20authoredEN exporter comparison, fresh Android6611b76b and strict-only PWA86096d64. Do not replay unchanged tests or confuse prior7855 repair-browser evidence with a new PWA browser run. Full S38 translation/owner correction workflow, English coverage, nearly10k catalog capacity, edition-specific EN covers, quality tiers/Planetka and device/release gates remain open. Frozen iOS83 awaits its existing approval.';
assert.equal(protectedValue(), protectedBefore);
const structural = validateExecution({ state, traceability: await read(`${base}/REQUIREMENTS_TRACEABILITY.json`), mapping: await read(`${base}/STAGE_REQUIREMENT_MAP.json`),
  sources: parseCsv(await fs.readFile(`${base}/requirements/v12/68_REQUIREMENT_ID_INDEX.csv`, 'utf8')),
  stageDefinitions: parseCsv(await fs.readFile(`${base}/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv`, 'utf8')),
  schemas: { state: await read(`${base}/requirements/v12/43_AUTOPILOT_STATE_SCHEMA.json`), traceability: await read(`${base}/requirements/v12/57_REQUIREMENTS_TRACEABILITY_SCHEMA.json`) } });
assert.equal(structural.pass, true, JSON.stringify(structural.errors)); assert.equal(structural.releaseReady, false);
await fs.writeFile(`${evidence}/final-state-structure.json`, json({ ...structural, priorCompleteEvidenceVerification: 'source-state-verification.json',
  acceptanceStateUnchanged: true, scope: 'Structural validation after artifact-cache update. Prior full evidence check remains source-bound; no acceptance criteria or approvals changed.' }), { flag: 'wx' });
const block = `<!-- s03-biography-review:begin -->
Source ${sourceCommit}: exact biography review and stale propagation.
Generated EN stays draft; CMS/source/target changes invalidate acceptance.
138 focused tests, one shared static run, one actual RU/EN writer/globe
source-browser case and full current biography export comparison passed.
All1684 RU/20 authored EN profiles retained;1672 source provenance records
preserved. No prose translation or human approval was created.
Android/dev ${android.buildId.slice(0,8)}: strict build, offline Gradle, APK checks and exact copies.
APK: ${android.apk.path}.
Controlled local-QA PWA ${pwa.buildId.slice(0,8)}: strict artifact/worker audit and exact copies;
zero new PWA browser executions. Prior7855 repair browser evidence is historical.
Evidence: evidence/S03/biography-review-20260908/result.json.
Full English coverage, visual owner corrections, nearly10k capacity, EN edition
covers, quality tiers/Planetka and device/release gates remain incomplete.
First-open stays S03; full S38 is not started. Frozen iOS83 unchanged/pending.
<!-- s03-biography-review:end -->`;
const after = new Map([['AUTOPILOT_STATE.json', json(state)]]);
for (const name of ['STATUS.md', 'NEXT_CODEX_PROMPT.txt', 'BLOCKERS.md']) {
  const content = before.get(name).replaceAll('\r\n', '\n'); assert.ok(content.includes('<!-- s03-biography-review:begin -->'));
  after.set(name, content.replace(/<!-- s03-biography-review:begin -->[\s\S]*?<!-- s03-biography-review:end -->/u, block));
}
const decisions = before.get('DECISIONS.md').replaceAll('\r\n', '\n'); assert.ok(!/^- D087:/mu.test(decisions));
after.set('DECISIONS.md', decisions.trimEnd() + `\n\n- D087: Biography review source ${sourceCommit} is compiled as\n  Android/dev ${android.buildId.slice(0,8)} and controlled local-QA PWA ${pwa.buildId.slice(0,8)}. Exact artifacts,\n  source digests, offline Gradle and APK binary checks passed. One source-browser\n  RU/EN writer/globe case uses the same native input snapshot; it injects OS APIs\n  and does not execute the APK. No new PWA browser suite was run for this bounded\n  data/hash change. Retain prior7855 repair/appearance receipts as historical.\n  Corpus export preserves all1684 RU/20 authored EN; no new translated approval\n  or prose was produced. Source and artifact checks do not accept S03, S38, full\n  bilingual content, installed devices, iOS83 or production release.\n`);
for (const name of names) assert.equal(await fs.readFile(`${base}/${name}`, 'utf8'), before.get(name));
await fs.writeFile(`${evidence}/result.json`, resultBytes);
for (const [name, content] of after) await fs.writeFile(`${base}/${name}`, content);
await fs.writeFile(`${evidence}/artifact-checkpoint.mjs`, await fs.readFile(new URL(import.meta.url)), { flag: 'wx' });
console.log(json({ evidence: `${evidence}/result.json`, sourceCommit, nativeBuildId: android.buildId, pwaBuildId: pwa.buildId,
  sourceInputsCurrent: true, uniqueSourceInputsVerified: files.size, acceptanceStateUnchanged: true, releaseReady: false }));
