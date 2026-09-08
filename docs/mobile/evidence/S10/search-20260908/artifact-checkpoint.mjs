import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateExecution } from '../../scripts/mobile/state.mjs';
import { parseCsv } from '../../scripts/mobile/csv.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/search-20260908`;
const sourceCommit = 'bda662c4779ac6852add6d6d6e94e36dfbb91f9a';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse((await fs.readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const git = args => execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], { encoding: 'utf8', windowsHide: true });
assert.equal(git(['rev-parse', 'HEAD']).trim(), sourceCommit);
const nativePath = `${base}/evidence/S04/search-android-20260908/result.json`;
const pwaPath = `${evidence}/pwa/result.json`;
const nativeBytes = await fs.readFile(nativePath), native = JSON.parse(nativeBytes);
const pwaBytes = await fs.readFile(pwaPath), pwa = JSON.parse(pwaBytes);
assert.equal(native.sourceCommit, sourceCommit); assert.equal(pwa.sourceCommit, sourceCommit);
assert.equal(native.status, 'BUILD_AND_BINARY_INSPECTION_PASSED');
assert.equal(pwa.status, 'LOCAL_QA_PWA_BUILD_AUDIT_AND_AFFECTED_BROWSER_PASSED');
assert.equal(pwa.strictArtifactAuditPassed, true); assert.equal(pwa.sourceUnchanged, true);
assert.equal(pwa.statistics.expected, 1); assert.equal(pwa.statistics.unexpected, 0);
assert.equal(pwa.statistics.skipped, 0); assert.equal(pwa.statistics.flaky, 0);
assert.equal(pwa.artifact.exactCopiesVerified, true);
const nativeMeta = await read(native.artifact.metadata), pwaMeta = await read(pwa.artifact.path + '/artifact.json');
for (const [record, metadata] of [[native, nativeMeta], [pwa, pwaMeta]]) {
  assert.equal(metadata.sourceCommit, sourceCommit); assert.equal(metadata.buildId, record.buildId);
  assert.equal(metadata.sourceInputs.sha256, sha(json(metadata.sourceInputs.files)));
}
assert.equal(nativeMeta.sourceInputs.sha256, native.sourceInputsSha256);
const sourceMap = new Map();
for (const input of [...nativeMeta.sourceInputs.files, ...pwaMeta.sourceInputs.files]) {
  if (sourceMap.has(input.path)) assert.equal(sourceMap.get(input.path), input.sha256);
  sourceMap.set(input.path, input.sha256);
}
for (const [path, expected] of sourceMap) assert.equal(sha(await fs.readFile(path)), expected, path);
const registry = 'data/book-canon-source-registry.json';
for (const metadata of [nativeMeta, pwaMeta]) assert.equal(metadata.sourceInputs.files.find(item => item.path === registry)?.sha256, sourceMap.get(registry));
assert.ok(sourceMap.has(registry));
const apk = await fs.readFile(native.apk.path);
assert.equal(apk.length, native.apk.bytes); assert.equal(sha(apk), native.apk.sha256);
assert.equal(sha(await fs.readFile(native.artifact.path + '/artifact.json')), native.artifact.sha256);
assert.equal(sha(await fs.readFile(pwa.artifact.path + '/artifact.json')), pwa.artifact.artifactSha256);
const nativeArtifact = { evidence: nativePath, sha256: sha(nativeBytes), buildId: native.buildId, sourceCommit,
  sourceInputsSha256: nativeMeta.sourceInputs.sha256, runtime: native.artifact.path, apk: native.apk,
  strictAudit: true, binaryAudit: true, copiesVerified: true, currentSource: true, installedRuntimeTested: false };
const pwaArtifact = { evidence: pwaPath, sha256: sha(pwaBytes), buildId: pwa.buildId, sourceCommit,
  sourceInputsSha256: pwaMeta.sourceInputs.sha256, runtime: pwa.artifact.path,
  artifactSha256: pwa.artifact.artifactSha256, files: pwa.artifact.files, bytes: pwa.artifact.bytes,
  strictAudit: true, copiesVerified: true, localQaAuthority: true, currentSource: true,
  browserExecutions: 1, browserPassed: true, physicalDeviceTested: false };
const original = await read(`${evidence}/source-result.json`);
const recordedAt = new Date().toISOString();
const result = { ...original, recordedAt, sourceCommit, status: 'SOURCE_AND_LOCAL_ARTIFACT_VALIDATION_PASSED',
  nativeArtifact, pwaArtifact,
  artifactSourceProof: { uniqueInputs: sourceMap.size, currentSourceBytesMatched: true,
    canonicalRegistry: { path: registry, sha256: sourceMap.get(registry) },
    apkBytesAndArchivedMetadataVerified: true },
  remaining: original.remaining.filter(item => !item.startsWith('Fresh Android/dev')),
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
const state = await read(`${base}/AUTOPILOT_STATE.json`);
const protectedBefore = JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection });
assert.equal(state.currentCriterionId, 'S03.acceptance');
state.verificationCache.s10Search = { status: result.status, evidence: `${evidence}/result.json`, sha256: sha(json(result)), sourceCommit,
  sourceInputsCurrent: true, uniqueUnitPasses: 259, sourceBrowserPasses: 2, nativeArtifact, pwaArtifact, stageAccepted: false, releaseReady: false };
for (const [id, files] of [['S10', [nativePath, pwaPath]], ['S04', [nativePath]], ['S03', [pwaPath]]]) {
  const stage = state.stages.find(value => value.id === id); stage.artifacts = [...new Set([...stage.artifacts, ...files])];
}
state.updatedAt = recordedAt;
state.resume.nextAction = 'Continue routed open work from committed S10 search bda662c4. Adult mobile writer/book search, RUEN labels and IDs, visible focus/reduced motion/normal motion and same scene have two real source-browser passes, 259 unique tests and final static. Android/dev and controlled PWA exact source artifacts are preserved; PWA real offline cold-RUEN case passed. Do not replay unchanged green checks. Next internal S10/S08 work: compiled search for nearly10k capacity, verified native/transliteration alias schema and separate child search, then collection/passport and editorial/content delivery. Current publication gate admits four books; do not promote held records, invent titles or treat this as full catalog coverage. First-open remains S03; full English/biographies, edition covers/owner workflow, Planetka/3D and device/store/legal/release gates remain open. Frozen iOS83 unchanged/pending; no production actions.';
assert.equal(JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection }), protectedBefore);
const structural = validateExecution({ state, traceability: await read(`${base}/REQUIREMENTS_TRACEABILITY.json`), mapping: await read(`${base}/STAGE_REQUIREMENT_MAP.json`),
  sources: parseCsv(await fs.readFile(`${base}/requirements/v12/68_REQUIREMENT_ID_INDEX.csv`, 'utf8')),
  stageDefinitions: parseCsv(await fs.readFile(`${base}/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv`, 'utf8')),
  schemas: { state: await read(`${base}/requirements/v12/43_AUTOPILOT_STATE_SCHEMA.json`), traceability: await read(`${base}/requirements/v12/57_REQUIREMENTS_TRACEABILITY_SCHEMA.json`) } });
assert.equal(structural.pass, true, JSON.stringify(structural.errors));
await fs.writeFile(`${evidence}/artifact-checkpoint.json`, json({ recordedAt, sourceCommit, nativeArtifact, pwaArtifact,
  sourceProof: result.artifactSourceProof, acceptanceStateUnchanged: true, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
await fs.writeFile(`${evidence}/final-state-structure.json`, json({ ...structural, acceptanceStateUnchanged: true,
  fullEvidenceCheckReused: 'source-state-verification.json', reason: 'Only working artifact cache and progress pointers changed after the full passed state check; accepted criteria, accepted head and frozen iOS projection are unchanged.' }), { flag: 'wx' });
await fs.writeFile(`${evidence}/result.json`, json(result));
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = `<!-- s10-search:begin -->\nSource ${sourceCommit}: adult globe search reveals writers, restores focus,\nand finds the same book by evidence-backed titles from either locale.\n259 unique tests, final static and2 actual mobile source-browser cases passed;\nwriter focus also checked with normal and reduced motion.\nAndroid/dev ${native.buildId.slice(0, 8)}: strict build, offline Gradle, real APK inspection.\nAPK: ${native.apk.path}.\nControlled local-QA PWA ${pwa.buildId.slice(0, 8)}: strict audit and1 actual cold-RUEN/offline case passed.\nBoth artifacts bind the exact canonical title authority registry and current source.\nCurrent strict publication gate admits4 books; this is not nearly10k coverage.\nEvidence: evidence/S10/search-20260908/result.json.\nFirst-open S03; S10 in progress. Full aliases, child isolation, collection/passport,\ncontent/biographies/edition covers/Planetka and device/release gates remain open.\nFrozen iOS83 unchanged/pending; no production actions. Earlier blocks are history.\n<!-- s10-search:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const path = `${base}/${name}`, content = (await fs.readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(content.includes('<!-- s10-search:begin -->'));
  await fs.writeFile(path, content.replace(/<!-- s10-search:begin -->[\s\S]*?<!-- s10-search:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D093:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + `\n\n- D093: Source bda662c4 is compiled as Android/dev ${native.buildId.slice(0, 8)} and\n  controlled local-QA PWA ${pwa.buildId.slice(0, 8)}. Exact source/registry inputs and\n  preserved APK/PWA identities are verified; one actual cold RU/EN PWA worker\n  scenario verifies the new bundled module remains available offline. The\n  current publication gate admits four books, each searchable by both existing\n  published titles. This does not certify full English content, nearly10k\n  capacity, child search, installed devices, store release or stage completion.\n`);
await fs.writeFile(`${evidence}/artifact-checkpoint.mjs`, await fs.readFile(new URL(import.meta.url)), { flag: 'wx' });
console.log(json({ status: result.status, sourceCommit, nativeBuild: native.buildId, pwaBuild: pwa.buildId,
  currentInputs: sourceMap.size, apk: native.apk, firstOpen: state.currentCriterionId, releaseReady: false }));
