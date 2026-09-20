import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Review before running. This records existing evidence; it runs no checks/builds.
// Usage: node docs/mobile/evidence/S13/visual-refinement-20260920/checkpoint.mjs <source40>
const [sourceCommit, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/visual-refinement-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-vr';
const priorSource = 'a115e9f11105551ed6e243787e95ffc29bccb1a0', priorCheckpoint = '9c14fa67acc219bfa0351b31c956e14fa4deefb6';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
// Keep the caller's safe.directory environment; never replace or rewrite it.
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/globe-scene-inspection.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const input of inputs) { assert.match(input.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const required = ['src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/globeWriterStudyGeometry.ts',
  'src/planet/writerStudySketch.ts', 'src/host/PlanetSceneInspectionControls.tsx', 'src/host/PlanetSceneInspectionControls.css'];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.checkpoint, priorCheckpoint); assert.equal(entry.previous, 'docs/mobile/evidence/S13/scene-inspection-20260920/result.json');
assert.equal(prior.pass, true); assert.equal(prior.sourceCommit, priorSource); noApproval(entry); noApproval(prior);
await verifyInputs(entry.preservedInputs);
assert.deepEqual(entry.preservedInputs.slice(0, 7), prior.preservedCompositionInputs);
assert.deepEqual(entry.preservedInputs.slice(7).map(item => item.path).sort(),
  ['src/components/globeWhaleStandGeometry.ts', 'src/components/globeLibraryGeometry.ts', 'src/components/globeCraftMaterials.ts'].sort());

// Compare exact relevant source fragments (normalizing line endings only), not
// the intentionally edited portrait factory as a whole. Both prior commits agree.
const portraitPath = required[0], currentPortrait = (await fs.readFile(portraitPath, 'utf8')).replaceAll('\r\n', '\n');
const fragment = (source, start, end) => {
  const first = source.indexOf(start); assert.ok(first >= 0 && source.indexOf(start, first + start.length) < 0, start);
  const last = source.indexOf(end, first + start.length); assert.ok(last > first, end); return source.slice(first, last);
};
const retainedPortraitFragments = [];
for (const [name, start, end] of [['plate-and-seat', '        const foot = own(', '        const eyeParts:'],
  ['scale-around-contact', '        for (const object of group.children) {', '        group.updateMatrixWorld(true);']]) {
  const current = fragment(currentPortrait, start, end);
  for (const commit of [priorSource, priorCheckpoint]) assert.equal(fragment(git(['show', `${commit}:${portraitPath}`]).replaceAll('\r\n', '\n'), start, end), current, name);
  retainedPortraitFragments.push({ name, sourcePath: portraitPath, start, endExclusive: end, sha256: sha(current), bytes: Buffer.byteLength(current), lineEndingsNormalized: true });
}

const attempts = { unit: 'a2', static: 'a1', browser: 'a1' }, runs = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0); noApproval(report);
  await verifyInputs(report.sourceInputs); requireInputs(report.sourceInputs);
  assert.deepEqual(report.tests, mode === 'unit' ? { passed: 4, failed: 0, skipped: 0 }
    : mode === 'browser' ? { passed: 1, failed: 0, skipped: 0, flaky: 0 } : null);
  const execution = await read(`${folder}/${mode}-${attempt}/execution.json`); assert.equal(execution.exitCode, 0);
  runs[mode] = { ...await ref(file), tests: report.tests, execution: await ref(`${folder}/${mode}-${attempt}/execution.json`) };
}
const units = await read(folder + '/unit-a2/vitest.json'), cases = units.testResults.flatMap(item => item.assertionResults);
assert.equal(cases.length, 4); assert.ok(cases.every(item => item.status === 'passed'));
const artPath = artifacts + '/art-a2/result.json', art = await read(artPath);
assert.equal(art.pass, true); assert.equal(art.sourceInputsUnchanged, true); assert.equal(art.actualApp, false); assert.equal(art.inspectionOnly, true);
noApproval(art, ['artAccepted', 'likenessAccepted', 'userRealismRequirementSatisfied', 'releaseReady']);
await verifyInputs(art.sourceInputs); requireInputs(art.sourceInputs, required.slice(0, 3)); assert.equal(art.geometryFinite, true); assert.equal(art.disposalVerified, true);
assert.deepEqual(art.frames.map(frame => [frame.kind, frame.tier, frame.view]), [['portraits','high','front'], ['portraits','high','three-quarter'],
  ['portraits','economy','front'], ['study','high','overview'], ['study','high','desk'], ['study','economy','overview']]);
for (const image of art.frames) { assert.ok(normalized(image.path).startsWith(normalized(path.dirname(artPath)) + '/')); await verifyInputs([image]); }

const browser = await read(folder + '/browser-a1/playwright.json'), attachments = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
const copied = attachments.filter(item => item.name === 'scene-inspection-source-evidence' && item.path); assert.equal(copied.length, 1);
const originals = [];
for (const child of await fs.readdir(artifacts + '/browser-a1', { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-a1', child.name, 'globe-scene-inspection.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copied[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
assert.equal(app.pass, true); assert.equal(app.actualApp, true); assert.equal(app.inspectionPersisted, false);
for (const key of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[key], []);
assert.ok(app.observations && !Array.isArray(app.observations));
for (const key of ['baseline', 'economy', 'resumed', 'finished']) { assert.equal(app.observations[key].sameScene, true); assert.equal(app.observations[key].surfaceCount, 1); }
const appImages = await Promise.all(['object-ru-1440', 'object-en-1440', 'object-en-390', 'marker-en-1440']
  .map(name => ref(path.join(path.dirname(actualAppCapture.path), `scene-inspection-${name}.png`))));
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.sourceCommit, sourceCommit); await verifyInputs(visual.sourceInputs); requireInputs(visual.sourceInputs);
noApproval(visual, ['artAccepted', 'childApproved', 'userRealismRequirementSatisfied', 'releaseReady']);
if ('pass' in visual) assert.ok(typeof visual.passMeaning === 'string' && visual.passMeaning.trim());
for (const [record, expected] of [[visual.artCapture, await ref(artPath)], [visual.actualAppCapture, actualAppCapture]]) {
  assert.equal(normalized(record.path), normalized(expected.path)); assert.equal(record.sha256, expected.sha256); await verifyInputs([record]);
}
const knownImages = [...art.frames, ...appImages]; assert.ok(Array.isArray(visual.images) && visual.images.length > 0);
assert.equal(new Set(visual.images.map(image => normalized(image.path))).size, visual.images.length);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.ok(typeof image.reviewer === 'string' && image.reviewer.trim());
  assert.ok(Array.isArray(image.findings) && image.findings.length && image.findings.every(item => typeof item === 'string' && item.trim()));
  assert.ok(knownImages.some(known => normalized(known.path) === normalized(image.path) && known.sha256 === image.sha256)); await verifyInputs([image]);
}
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath), oldInventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.auditValid, true); await verifyInputs(inventory.sourceInputs);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
assert.deepEqual(inventory.items.map(item => item.id), oldInventory.items.map(item => item.id));
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), oldInventory.ownerAdditions.map(item => item.id).sort());
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }

const pwaPath = folder + '/pwa-a1/result.json', androidPath = folder + '/android-a1/result.json';
const pwa = await read(pwaPath), android = await read(androidPath);
for (const [record, manifestSha] of [[pwa, pwa.artifact?.artifactSha256], [android, android.artifact?.sha256]]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  noApproval(record, ['stageAccepted', 'releaseReady', 'productionActionsPerformed']); assert.ok(normalized(record.artifact.path).startsWith(artifacts + '/'));
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: manifestSha });
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId); assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files); requireInputs(manifest.sourceInputs.files);
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
const pwaAudit = await read(folder + '/pwa-a1/strict-audit.json'), copy = await read(folder + '/pwa-a1/copy-verification.json');
assert.equal(pwaAudit.pass, true); assert.equal(pwaAudit.identity.sourceCommit, sourceCommit); assert.equal(pwaAudit.identity.buildId, pwa.buildId);
assert.equal(copy.pass, true); assert.equal(copy.files, pwa.artifact.files); assert.equal(copy.bytes, pwa.artifact.bytes);
const copyLedger = await verifyRef(copy.detailedLedger); assert.equal(copyLedger.pass, true); assert.equal(copyLedger.files.length, copy.files);
assert.equal(copy.artifactManifest.sha256, pwa.artifact.artifactSha256); await verifyInputs([copy.artifactManifest]);
for (const key of ['strictRuntimeAudit', 'binaryAudit', 'build']) {
  const audit = await read(android.checks[key]); assert.equal(audit.pass, true);
  const identity = key === 'strictRuntimeAudit' ? audit.identity : key === 'binaryAudit' ? audit.sourceArtifact : audit;
  assert.equal(identity.sourceCommit, sourceCommit); assert.equal(identity.buildId, android.buildId);
  if (key === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); await verifyInputs(audit.rawReports);
    const zipLedger = await verifyRef(audit.zip.ledger); assert.equal(zipLedger.length, audit.zip.entries); }
}
await verifyInputs([android.apk]); assert.equal((await fs.stat(android.apk.path)).size, android.apk.bytes);
for (const [reference, expected] of [[prior.pwa, '3e5a4b1d8475f954618571fce69e38339ccac1608accb591743f22f7bcaaa2dd'],
  [prior.android, '4edbf32fb4bff013ad84c1809d5fcf7747a7d054301eb7da9ba6cab4499072ac']]) {
  const old = await verifyRef(reference); assert.equal(old.pass, true); assert.equal(old.buildId, expected); assert.equal(old.sourceCommit, priorSource);
  const manifest = await verifyRef({ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 });
  assert.equal(manifest.buildId, expected); if (old.apk) await verifyInputs([old.apk]);
}

// All assertions and serialization precede the first write. Compare global
// inputs again immediately before writing so another checkpoint is not lost.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalsByFile = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalsByFile.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S13');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const beforeStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s13SceneInspection.path, entry.previous); await verifyRef(state.verificationCache.s13SceneInspection);
const decisions = originalsByFile.get(globalFiles[1]), marker = '<!-- s13-visual-refinement-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D140:/gmu)].length, 1); assert.equal(/^- D141:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalsByFile.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const nextAction = 'Implement a shared stand/background draft under S13.CUSTOM-003 and document 17 sections 2/7: tab changes retain the draft, one Apply saves both, Cancel/error restores both. This next slice intentionally changes the existing composition controller and appearance UI; preserve the single scene, camera/atlas owners and all current geometry including reduced saucers, golden whales and 984-book library. Update the legacy browser cancel-on-tab expectation. Keep recorded visual defects and remaining full catalog, child, device, iOS and release acceptance open; reuse unchanged evidence.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'VISUAL_REFINEMENT_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, runs,
  artCapture: await ref(artPath), actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true,
  visualReview: await ref(visualPath), inspectedImageCount: visual.images.length, capturedImageCount: knownImages.length,
  starterSetSourceInventory: await ref(inventoryPath), requiredStarterItems: 29, sourceBoundStarterItems: 12, acceptedStarterItems: 0, ownerAddedCount: 3,
  ownerAdditionIds: inventory.ownerAdditions.map(item => item.id), preservedInputs: entry.preservedInputs,
  preservedCompositionInputs: entry.preservedInputs.slice(0, 7), retainedLibraryDensity: prior.retainedLibraryDensity,
  retainedPortrait: { baselineCommits: [priorSource, priorCheckpoint], fragments: retainedPortraitFragments },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD141Recorded: true, actualSceneRenderedInChrome: true, controlledNativePorts: true, inspectionPersisted: false,
  artAccepted: false, likenessAccepted: false, userRealismRequirementSatisfied: false, childApproval: false, rightsApproval: false,
  screenReaderAcceptance: false, installedNativeDevice: false, devicePerformanceAccepted: false, iosCompiled: false,
  grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, inventoryPath, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const [id, note] of [['S13.CUSTOM-001', ' Refined existing portrait surfaces and writer-study depth; no new catalog IDs or art acceptance. The final reduced saucer, contact seat and portrait scale have exact prior-source fragment proof.'],
  ['S13.CUSTOM-003', ' Seven composition owners remain byte-identical; the shared original sketch preview uses existing transient inspection and does not add a persistence or scene owner.'],
  ['S13.CUSTOM-007', ' Four focused geometry cases, TypeScript, one actual Chrome interaction and one PWA offline smoke bind this source and preserved local builds. Scoped visual findings remain separate from likeness, art, screen-reader and device acceptance.']]) {
  const criterion = stage.criteria.find(item => item.id === id); assert.equal(criterion.status, 'IN_PROGRESS');
  push(criterion.evidence, resultPath); criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += note;
}
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/check.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/capture.mjs a2`, `node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
push(state.stages.find(item => item.id === 'S12').artifacts, inventoryPath); state.updatedAt = recordedAt; state.headSha = sourceCommit;
state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S13 visual refinement: only four selected geometry cases, TypeScript, one actual Chrome interaction, six isolated captures and preserved PWA/Android builds are current scoped evidence. Unchanged suites were not rerun or counted; no likeness, art, child, screen-reader, device or release acceptance.');
state.verificationCache.s13VisualRefinement = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
const decision = `\n- D141: Refine the existing ceramic portraits and writer-study materials/lighting; share the seven authored decorative sketch strokes between the physical sheet and its localized inspection view. Keep the final reduced saucer, contact seat and 1.12 portrait scale, seven composition owners, golden whales and library geometry. Source ${sourceCommit} is bound to four focused geometry cases, TypeScript, one actual Chrome interaction, isolated captures with separately recorded visual findings, and preserved PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. Inventory remains 29 required / 12 source-bound / zero accepted, plus three separate owner additions. Likeness, realism, art, child, screen-reader, installed-device and release acceptance remain open. Evidence: evidence/S13/visual-refinement-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} records bounded portrait/study refinement and a shared original-sketch inspection view.\nFour geometry cases, TypeScript, one actual Chrome interaction and one PWA offline smoke pass; unrelated suites are not counted.\nSix isolated captures and separately recorded inspected images are evidence, not likeness/art/realism approval. Final saucers and composition owners are preserved.\nInventory remains 29 required, 12 source-bound, zero accepted, plus three owner additions.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S13/visual-refinement-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s13-visual-refinement-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalsByFile.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalsByFile) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, counts, firstOpen: 'S03', stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
