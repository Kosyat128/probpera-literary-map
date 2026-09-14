import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';

// Consume completed audits and the root's actual visual review. No compilation,
// browser invocation, image review or editorial/release approval occurs here.
const root = await fs.realpath(process.cwd());
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const [flag, sourceCommit, ...rest] = process.argv.slice(2);
assert.equal(flag, '--source-commit'); assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(rest.length, 0);
const head = () => execFileSync('git', ['-c', 'safe.directory=' + root.replaceAll('\\', '/'), 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit, 'Explicit expected source must be current HEAD');
const base = 'docs/mobile', out = base + '/evidence/S10/opposite-locale-search-20260914';
const headerOut = base + '/evidence/S09/archive-header-20260914', androidOut = base + '/evidence/S04/archive-search-android-20260914', pwaOut = out + '/pwa';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
function resolve(relative) {
  assert.ok(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative) && !relative.includes('\\'));
  assert.ok(!relative.split('/').some(part => !part || part === '.' || part === '..'));
  const target = path.resolve(root, relative), local = path.relative(root, target);
  assert.ok(local && local !== '..' && !local.startsWith('..' + path.sep) && !path.isAbsolute(local), relative); return target;
}
async function bytes(relative) {
  const target = resolve(relative); assert.equal(await fs.realpath(target), target, 'Linked input: ' + relative);
  const stat = await fs.lstat(target); assert.ok(stat.isFile() && !stat.isSymbolicLink(), relative); return fs.readFile(target);
}
const read = async relative => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await bytes(relative)).replace(/^\uFEFF/u, ''));
async function assertAbsent(relative) {
  const target = resolve(relative), parent = path.dirname(target); assert.equal(await fs.realpath(parent), parent);
  await assert.rejects(fs.lstat(target), error => error.code === 'ENOENT', 'Refusing to overwrite ' + relative);
}
async function checkRecordedFile(record) {
  assert.match(record.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(record.bytes) && record.bytes > 0);
  const raw = await bytes(record.path); assert.equal(raw.length, record.bytes, record.path); assert.equal(sha(raw), record.sha256, record.path); return raw;
}
function preparation(value) { assert.equal(value.stageAccepted, false); assert.equal(value.releaseReady, false); }
function identity(value, buildId) { assert.equal(value.sourceCommit, sourceCommit); assert.equal(value.buildId, buildId); }
function passingCase(value) { for (const [key, expected] of Object.entries({ expected: 1, skipped: 0, unexpected: 0, flaky: 0 })) assert.equal(value[key], expected, key); }

const sourceBytes = await bytes(out + '/source-result.json'), source = JSON.parse(sourceBytes);
const previousSearchBytes = await bytes(out + '/result.json'); assert.deepEqual(JSON.parse(previousSearchBytes), source);
const previousHeaderBytes = await bytes(headerOut + '/result.json'), header = JSON.parse(previousHeaderBytes);
for (const record of [source, header]) { assert.equal(record.status, 'SOURCE_VALIDATED_ARTIFACT_REFRESH_PENDING'); preparation(record); }
assert.equal(source.validation.finalPassingUnitCases, 58); assert.equal(source.validation.repeatedCases, 10);
assert.equal(source.validation.sourceInputsCurrent, true); assert.equal(header.validation.sourceInputsCurrent, true);
assert.equal(source.retainedHeaderCheckpoint, headerOut + '/result.json');
for (const relative of [source.validation.initialUnit, source.validation.repeatedUnit, source.validation.typecheck, source.validation.sourceBrowser]) assert.equal((await read(out + '/' + relative)).pass, true);
for (const relative of [header.validation.typecheck, header.validation.browser]) assert.equal((await read(headerOut + '/' + relative)).pass, true);
for (const [folder, record] of [[out, source], [headerOut, header]]) {
  const visual = await read(folder + '/' + record.validation.visual); assert.equal(visual.pass, true); preparation(visual);
  for (const image of visual.images) { assert.equal(image.viewedAtOriginalResolution, true); await checkRecordedFile(image); }
}
const androidBytes = await bytes(androidOut + '/result.json'), android = JSON.parse(androidBytes);
const pwaBytes = await bytes(pwaOut + '/result.json'), pwa = JSON.parse(pwaBytes);
assert.equal(android.status, 'BUILD_AND_BINARY_INSPECTION_PASSED');
assert.equal(pwa.status, 'LOCAL_QA_PWA_BUILD_AUDIT_AND_AFFECTED_BROWSER_PASSED');
for (const record of [android, pwa]) { assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u); preparation(record); }
assert.equal(android.validation.nativeStrictAudit.pass, true); assert.equal(android.validation.build.pass, true); assert.equal(android.validation.binaryAudit.pass, true);
assert.equal(pwa.strictArtifactAuditPassed, true); assert.equal(pwa.sourceUnchanged, true); assert.equal(pwa.browserTestsRun, true);
assert.equal(pwa.browserExecutions, 1); passingCase(pwa.statistics); assert.equal(pwa.browserProof.length, 1);
assert.equal(pwa.browserProof[0].status, 'passed'); assert.deepEqual(pwa.browserProof[0].errors, []);
assert.equal(pwa.browserProof[0].title, 'offline PWA cross-language author search and book return retain the globe and integrated archive card');
assert.equal(pwa.browserProof[0].project, 'pwa-desktop'); assert.equal(pwa.artifact.exactCopiesVerified, true);

const union = new Map(), unionCase = new Map();
function addInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 10000); const seen = new Set();
  for (const input of inputs) {
    resolve(input.path); assert.match(input.sha256, /^[a-f0-9]{64}$/u);
    const key = input.path.toLowerCase(); assert.ok(!seen.has(key), 'Duplicate input: ' + input.path); seen.add(key);
    if (unionCase.has(key)) assert.equal(unionCase.get(key), input.path, 'Case collision: ' + input.path); unionCase.set(key, input.path);
    if (union.has(input.path)) assert.equal(union.get(input.path), input.sha256, input.path); union.set(input.path, input.sha256);
  }
}
addInputs(source.sourceInputs);
const metadata = [];
for (const [record, expectedSha, kind] of [[android, android.artifact.sha256, 'literary-planet-bundled-native-preparation'], [pwa, pwa.artifact.artifactSha256, 'literary-planet-controlled-pwa-preparation']]) {
  const raw = await bytes(record.artifact.path + '/artifact.json'); assert.equal(sha(raw), expectedSha);
  const artifact = JSON.parse(raw); identity(artifact, record.buildId); assert.equal(artifact.kind, kind); assert.equal(artifact.releaseReady, false);
  assert.equal(artifact.sourceInputs.sha256, sha(json(artifact.sourceInputs.files))); addInputs(artifact.sourceInputs.files); metadata.push(artifact);
}
const [nativeMeta, pwaMeta] = metadata;
assert.equal(nativeMeta.platform, 'android'); assert.equal(nativeMeta.channel, 'dev'); assert.equal(pwaMeta.localQaAuthority, true);
assert.equal(nativeMeta.sourceInputs.sha256, android.sourceInputsSha256);
assert.equal(sha(await bytes(android.artifact.metadata)), android.artifact.sha256);
assert.equal(sha(await bytes(pwaOut + '/artifact.json')), pwa.artifact.artifactSha256);
addInputs(await read(pwaOut + '/support-after.json'));
// S09 predates intentional S10 App/search edits. Bind its implementation files,
// rather than claiming that all unrelated inputs of its old run are current.
const headerInputs = await read(headerOut + '/browser-a2/source-inputs.json');
assert.equal(headerInputs.unchanged, true); assert.deepEqual(headerInputs.before, headerInputs.after);
assert.equal(sha(json(headerInputs.before)), header.sourceInputsSha256);
const priorHeaderInputs = new Map(headerInputs.after.map(input => [input.path, input.sha256]));
const headerImplementationPins = header.implementation.map(relative => {
  const expected = priorHeaderInputs.get(relative); assert.match(expected, /^[a-f0-9]{64}$/u);
  assert.equal(union.get(relative), expected, 'Retained header source: ' + relative); return { path: relative, sha256: expected };
});
for (const relative of source.implementation) assert.ok(union.has(relative));
for (const [relative, expected] of union) assert.equal(sha(await bytes(relative)), expected, relative);
const registry = 'data/book-canon-source-registry.json'; assert.ok(union.has(registry));
for (const artifact of metadata) assert.equal(artifact.sourceInputs.files.find(input => input.path === registry)?.sha256, union.get(registry));
assert.equal(union.get('scripts/mobile/native-base-assets.json'), header.coverSelection.manifestSha256);
await checkRecordedFile(android.apk);

// Reuse completed strict/build/copy audits. Verify preserved report hashes and
// inventories without rebuilding, rerunning auditors or repeating their full
// runtime byte scans after the exact-copy preservation already performed them.
for (const relative of [android.validation.nativeStrictAudit.path, android.validation.binaryAudit.path, android.validation.build.report, android.artifact.metadata]) {
  const pin = android.reports.find(record => record.path === relative); assert.ok(pin, relative); await checkRecordedFile(pin);
}
const nativeAudit = await read(android.validation.nativeStrictAudit.path), binary = await read(android.validation.binaryAudit.path), build = await read(android.validation.build.report);
for (const audit of [nativeAudit, binary, build]) assert.equal(audit.pass, true);
identity(nativeAudit.identity, android.buildId); identity(binary.sourceArtifact, android.buildId); identity(build, android.buildId);
assert.equal(binary.sourceArtifact.sha256, android.artifact.sha256); assert.equal(binary.apk.sha256, android.apk.sha256); assert.equal(binary.apk.bytes, android.apk.bytes);
assert.deepEqual(binary.bundledAssets.omittedValidationMetadata, ['.vite/manifest.json']);
assert.equal(binary.bundledAssets.expected, binary.bundledAssets.matched + binary.bundledAssets.omittedValidationMetadata.length);
assert.equal(build.registrySourceSha256, union.get(registry));
const nativeCopies = await read(android.validation.preservedCopies); assert.equal(nativeCopies.pass, true); identity(nativeCopies, android.buildId);
assert.equal(nativeCopies.runtime, android.artifact.path); assert.equal(nativeCopies.artifactSha256, android.artifact.sha256);
assert.equal(nativeCopies.apk.sha256, android.apk.sha256); assert.equal(nativeCopies.apk.bytes, android.apk.bytes);
const pwaAuditPath = pwaOut + '/strict-artifact-audit.json', pwaRunPath = pwaOut + '/run-result.json';
for (const relative of [pwaAuditPath, pwaRunPath, pwaOut + '/artifact.json', pwaOut + '/support-after.json']) {
  const pin = pwa.preservedFiles.find(record => record.path === relative); assert.ok(pin, relative); await checkRecordedFile(pin);
}
const pwaAudit = await read(pwaAuditPath), pwaRun = await read(pwaRunPath), pwaCopies = await read(pwaOut + '/artifact-copy-verification.json');
assert.equal(pwaAudit.pass, true); identity(pwaAudit.identity, pwa.buildId); assert.equal(pwaAudit.identity.localQaAuthority, true);
assert.equal(pwaRun.pass, true); identity(pwaRun, pwa.buildId); assert.equal(pwaRun.browserExecutions, 1); passingCase(pwaRun.statistics);
identity(pwaCopies, pwa.buildId); assert.equal(pwaCopies.exactCopiesVerified, true); assert.equal(pwaCopies.path, pwa.artifact.path); assert.equal(pwaCopies.artifactSha256, pwa.artifact.artifactSha256);
for (const [artifact, copyFiles, digest] of [[nativeMeta, nativeCopies.files, android.artifact.sha256], [pwaMeta, pwaCopies.inventory, pwa.artifact.artifactSha256]]) {
  assert.equal(copyFiles.length, artifact.inventory.length + 1);
  const files = new Map(copyFiles.map(file => [file.path, file])); assert.equal(files.size, copyFiles.length); assert.equal(files.get('artifact.json')?.sha256, digest);
  for (const file of artifact.inventory) assert.deepEqual(files.get(file.path), file);
}
assert.equal(pwaCopies.files, pwaCopies.inventory.length); assert.equal(pwaCopies.files, pwa.artifact.files);
assert.equal(pwaCopies.bytes, pwaCopies.inventory.reduce((total, file) => total + file.bytes, 0)); assert.equal(pwaCopies.bytes, pwa.artifact.bytes);
const visualPath = pwaOut + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); identity(visual, pwa.buildId); preparation(visual); assert.equal(visual.images.length, 2);
assert.equal(new Set(visual.images.map(image => image.path)).size, 2);
for (const locale of ['ru', 'en']) assert.ok(visual.images.some(image => image.path.endsWith('-' + locale + '.png')), 'Missing reviewed ' + locale + ' screenshot');
for (const image of visual.images) {
  assert.ok(image.path.startsWith(pwaOut + '/')); assert.equal(image.viewedAtOriginalResolution, true); await checkRecordedFile(image);
  const preserved = pwa.preservedFiles.find(record => record.path === image.path); assert.ok(preserved); assert.equal(image.sha256, preserved.sha256); assert.equal(image.bytes, preserved.bytes);
}

const recordedAt = new Date().toISOString();
const next = 'Prepare a parallel-safe S11 offline/download/synchronization entry on the canonical export and dependency contracts, with disjoint file ownership and bounded validation. No factual archive population. Owner final canonical archive synchronization and complete RUEN/content/rights validation follow app implementation (D107). Preserve these artifacts and do not repeat unchanged builds or tests.';
const artifacts = {
  android: { evidence: androidOut + '/result.json', sha256: sha(androidBytes), sourceCommit, buildId: android.buildId, sourceInputsSha256: nativeMeta.sourceInputs.sha256, runtime: android.artifact.path, artifactSha256: android.artifact.sha256, apk: android.apk, strictAudit: true, binaryAudit: true, copiesVerified: true, installedRuntimeTested: false },
  pwa: { evidence: pwaOut + '/result.json', sha256: sha(pwaBytes), sourceCommit, buildId: pwa.buildId, sourceInputsSha256: pwaMeta.sourceInputs.sha256, artifact: pwa.artifact, strictAudit: true, browserExecutions: 1, browserPassed: true, localQaAuthority: true, artifactVisualReview: visualPath, artifactVisualReviewSha256: sha(await bytes(visualPath)), installedRuntimeTested: false },
};
const proof = { currentInputsVerified: union.size, currentSourceBytesMatched: true, headerImplementationPins,
  canonicalRegistry: { path: registry, sha256: union.get(registry) }, actualApkAndRawMetadataVerified: true,
  preservationInventoriesAndPinnedAuditReportsVerified: true, completedAuditsReused: true, additionalBuilds: 0, additionalBrowserRuns: 0,
  scope: 'Local source/artifact integrity and already recorded browser/visual evidence; no editorial, rights or release approval.' };
const status = 'LOCAL_SOURCE_AND_ARTIFACT_VALIDATION_PASSED';
const result = { ...source, recordedAt, status, sourceCommit, artifacts, artifactSourceProof: proof, actualPwaBrowserPasses: 1, artifactVisualReview: visualPath, stageAccepted: false, releaseReady: false, productionActionsPerformed: false, next };
const headerResult = { ...header, recordedAt, status, sourceCommit, artifacts, artifactSourceProof: proof, combinedArtifactCheckpoint: out + '/result.json', actualPwaBrowserPasses: 1, artifactVisualReview: visualPath, stageAccepted: false, releaseReady: false, productionActionsPerformed: false, next };
const stateBytes = await bytes(base + '/AUTOPILOT_STATE.json'), state = JSON.parse(stateBytes);
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance');
assert.equal(state.verificationCache.s10OppositeLocaleSearch.sha256, sha(previousSearchBytes)); assert.equal(state.verificationCache.s09ArchiveHeader.sha256, sha(previousHeaderBytes));
const protect = value => JSON.stringify({ head: value.headSha, currentStage: value.currentStageId, currentCriterion: value.currentCriterionId,
  stages: value.stages.map(({ artifacts, lastGreenCommands, ...stage }) => stage), ios: value.verificationCache.s04IosGlobeProjection, owner: value.verificationCache.ownerCatalogWorkflow });
const protectedState = protect(state);
state.verificationCache.s10OppositeLocaleSearch = { ...state.verificationCache.s10OppositeLocaleSearch, status, evidence: out + '/result.json', sha256: sha(json(result)), sourceCommit, sourceInputsCurrent: true, artifacts, pwaBrowserPasses: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s09ArchiveHeader = { ...state.verificationCache.s09ArchiveHeader, status, evidence: headerOut + '/result.json', sha256: sha(json(headerResult)), sourceCommit, implementationInputsCurrent: true, artifacts, pwaBrowserPasses: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s04ArchiveSearchAndroid = { status: android.status, evidence: androidOut + '/result.json', sha256: sha(androidBytes), sourceCommit, buildId: android.buildId, stageAccepted: false, releaseReady: false };
for (const [id, files] of [['S04', [androidOut + '/result.json']], ['S09', [pwaOut + '/result.json', out + '/result.json']], ['S10', [androidOut + '/result.json', pwaOut + '/result.json']]]) {
  const stage = state.stages.find(value => value.id === id); assert.ok(stage); stage.artifacts = [...new Set([...stage.artifacts, ...files])];
  if (id !== 'S04') stage.lastGreenCommands = [...stage.lastGreenCommands, 'Same combined exact-source Android/dev and local-QA PWA retained; one actual offline RUEN author-search/book-return case and two original-resolution artifact screenshots passed.'];
}
state.updatedAt = recordedAt; state.resume.nextAction = next + ' First-open S03 and stage acceptance remain unchanged; frozen iOS83 stays pending. No production action.';
assert.equal(protect(state), protectedState);
const buildLines = `Android/dev ${android.buildId.slice(0, 8)}: compiled APK, strict runtime and binary/copy audits passed.\nAPK: ${android.apk.path}.\nLocal-QA PWA ${pwa.buildId.slice(0, 8)}: strict audit, actual offline RUEN search/return\nand 2 original-resolution screenshots passed. Both artifacts bind source ${sourceCommit}.`;
const blocks = {
  'opposite-locale-search-20260914': `Existing opposite-locale author names enrich shared search while current labels,\ncanonical IDs and publication/authorship gates remain authoritative.\n58 final search cases; only 10 repeated after a test-only typing fix. Final typecheck\nand 1 actual native-source RUEN search/navigation case passed.\n${buildLines}\nThe same builds include the integrated archive header and current selected cover pairs.\nOwner fills archives; final canonical sync follows app implementation (D107).\nNext: prepare parallel-safe S11 offline/download/sync entry on canonical exports.\nEvidence: evidence/S10/opposite-locale-search-20260914/result.json.\nFirst-open S03; content/child/device/commerce/legal/release gates remain open.`,
  'archive-header-20260914': `The live canonical full-width Literary Archive masthead is integrated into the card.\nRUEN close/focus/book return and theme/scene ownership are retained.\nUTF-8 source decoding was corrected; the old four-work fixture count was invalid.\nThe current development snapshot contains 33 eligible local cover pairs; 54 missing\nfiles are shared hash-pinned native/PWA inputs, preserving bytes and rights metadata.\n287 focused cases, typecheck and the actual native-source RUEN case passed.\n${buildLines}\nThese are the SAME combined S10 artifacts, including opposite-locale author search.\nBounded bootstrap cap remains 72 MiB; large final archives use separate content packages.\nOwner final archives sync after app implementation (D107); no factual archive filling.\nEvidence: evidence/S09/archive-header-20260914/result.json. First-open S03; no stage acceptance.`,
};
const documents = [];
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const relative = base + '/' + name, original = await bytes(relative); let text = original.toString('utf8').replaceAll('\r\n', '\n');
  for (const [marker, body] of Object.entries(blocks)) {
    const begin = '<!-- ' + marker + ':begin -->', end = '<!-- ' + marker + ':end -->'; assert.equal(text.split(begin).length, 2); assert.equal(text.split(end).length, 2);
    const start = text.indexOf(begin), finish = text.indexOf(end, start); assert.ok(finish > start);
    text = text.slice(0, start) + begin + '\n' + body + '\n' + end + text.slice(finish + end.length);
  }
  documents.push({ relative, original, text });
}
const decisionsPath = base + '/DECISIONS.md', decisionsBytes = await bytes(decisionsPath), previousDecisions = decisionsBytes.toString('utf8');
assert.ok(/^- D107:/mu.test(previousDecisions)); assert.ok(!/^- D112:/mu.test(previousDecisions));
const decisions = previousDecisions.trimEnd() + `\n\n- D112: Source ${sourceCommit} produced one combined Android/dev\n  ${android.buildId.slice(0, 8)} and local-QA PWA ${pwa.buildId.slice(0, 8)} for the integrated archive header,\n  shared pinned cover closure and opposite-locale canonical author search.\n  Current source pins, exact APK/raw artifact hashes, preserved audit/copy reports\n  and actual offline RUEN search/return with original-resolution images agree.\n  S09 and S10 reference these same artifacts; no duplicate builds or test-count\n  inflation. These are development/QA proofs, not installed-device, editorial,\n  rights, owner or stage/release acceptance. Prepare a parallel-safe S11\n  offline/download/sync entry on canonical exports; D107 final owner archive\n  synchronization remains deferred until app implementation is complete.\n`;
const checkpointPath = out + '/artifact-checkpoint.json', verificationPath = out + '/final-state-verification.json', helperPath = out + '/artifact-checkpoint.mjs';
for (const relative of [checkpointPath, verificationPath, helperPath, headerOut + '/source-result.json']) await assertAbsent(relative);
const helperBytes = await fs.readFile(fileURLToPath(import.meta.url));
// Finish every preflight check before mutation; refuse concurrent source/state
// or progress edits rather than overwriting another bounded slice.
assert.equal(head(), sourceCommit); assert.deepEqual(await bytes(base + '/AUTOPILOT_STATE.json'), stateBytes);
assert.deepEqual(await bytes(out + '/result.json'), previousSearchBytes); assert.deepEqual(await bytes(headerOut + '/result.json'), previousHeaderBytes); assert.deepEqual(await bytes(decisionsPath), decisionsBytes);
for (const document of documents) assert.deepEqual(await bytes(document.relative), document.original);
await fs.writeFile(resolve(headerOut + '/source-result.json'), previousHeaderBytes, { flag: 'wx' });
await fs.writeFile(resolve(checkpointPath), json({ schemaVersion: 1, recordedAt, sourceCommit, artifacts, sourceProof: proof, acceptedStateUnchanged: true, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
await fs.writeFile(resolve(out + '/result.json'), json(result)); await fs.writeFile(resolve(headerOut + '/result.json'), json(headerResult)); await fs.writeFile(resolve(base + '/AUTOPILOT_STATE.json'), json(state));
for (const document of documents) await fs.writeFile(resolve(document.relative), document.text);
await fs.writeFile(resolve(decisionsPath), decisions);
const verification = await verifyExecutionFiles(root); await fs.writeFile(resolve(verificationPath), json(verification), { flag: 'wx' }); assert.equal(verification.pass, true, JSON.stringify(verification.errors));
await fs.writeFile(resolve(helperPath), helperBytes, { flag: 'wx' });
console.log(json({ status, sourceCommit, android: android.buildId, pwa: pwa.buildId, currentInputsVerified: union.size, combinedHeaderEvidence: headerOut + '/result.json', stateVerification: verification.pass, firstOpen: state.currentCriterionId, releaseReady: false }));
