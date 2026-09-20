import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Preparation draft: validate existing evidence only, once final reports exist.
// No test, build, inventory or capture runs occur here.
// Usage: node <this-file> <source40> [browserAttempt=a1] [unitAttempt=a1] [staticAttempt=a1]
const [sourceCommit, browserAttempt = 'a1', unitAttempt = 'a1', staticAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [browserAttempt, unitAttempt, staticAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/stand-inspection-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-stand-inspection';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/stand-inspection.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const required = ['src/components/globeStandInspection.ts', 'src/host/planetStandInspection.ts', 'src/App.tsx',
  'src/components/GlobeCameraRig.tsx', 'src/components/GlobeIncludedStand.tsx', 'src/components/LiteraryGlobe.tsx',
  'src/components/LiteraryWorldMap.tsx', 'src/host/PlanetStandControls.tsx', 'src/host/PlanetStandControls.css'];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S13'); assert.equal(entry.checkpoint, '47c9f7cc57f4bfc9c762ee22e877c9084004f996');
assert.equal(entry.previous, 'docs/mobile/evidence/S13/book-cloud-stand-20260920/result.json');
assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 36); await verifyInputs(entry.preservedInputs);
const compositionOwners = ['src/planet/globeComposition.ts', 'src/host/planetComposition.ts', 'src/host/planetCompositionPresentation.ts',
  'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/globeAtlas.ts', 'src/components/useGlobeStyleState.ts'];
requireInputs(entry.preservedInputs, compositionOwners);
assert.deepEqual(entry.changedInputsBefore.map(item => item.path).sort(), ['src/App.tsx', 'src/components/GlobeCameraRig.tsx',
  'src/components/GlobeIncludedStand.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
  'src/host/PlanetStandControls.css', 'src/host/PlanetStandControls.tsx']);
for (const item of entry.changedInputsBefore) {
  assert.equal(item.sourceCommit, entry.checkpoint);
  assert.equal(sha(execFileSync('git', ['show', entry.checkpoint + ':' + item.path], { windowsHide: true, env: process.env })), item.gitBlobSha256);
}
assert.deepEqual(entry.newSourcePaths, ['src/components/globeStandInspection.ts', 'src/host/planetStandInspection.ts']);
await verifyInputs([prior.visualReview, prior.priorVisualReview, prior.priorSceneVisualReview, prior.priorArtReview, prior.priorArtCapture]);
assert.deepEqual(entry.priorStarterSetSourceInventory, prior.starterSetSourceInventory);
assert.equal(entry.inventoryHandling, 'historical-with-explicit-changed-inputs');
const inventory = await verifyRef(prior.starterSetSourceInventory), inventoryChangedInputs = [];
assert.equal(inventory.auditValid, true);
noApproval(inventory, ['stageAccepted', 'grantsEntitlement', 'productionActionsPerformed', 'releaseReady']);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 13, 0, 3]);
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }
const allowedInventoryChanges = new Set(entry.changedInputsBefore.map(item => item.path));
for (const item of inventory.sourceInputs) {
  const current = await ref(item.path);
  if (current.sha256 !== item.sha256) {
    assert.ok(allowedInventoryChanges.has(item.path), 'Unexpected historical inventory drift: ' + item.path);
    inventoryChangedInputs.push({ path: item.path, priorSha256: item.sha256, currentSha256: current.sha256 });
  }
}
assert.ok(inventoryChangedInputs.length > 0);

const unitFiles = ['src/components/globeStandInspection.test.ts', 'src/components/GlobeCameraRig.test.tsx',
  'src/host/planetStandInspection.test.ts'], units = await read(`${folder}/unit-${unitAttempt}/vitest.json`);
assert.deepEqual(units.testResults.map(item => normalized(item.name)).sort(), unitFiles.map(normalized).sort());
const cases = units.testResults.flatMap(item => item.assertionResults), unitCount = cases.length;
assert.ok(unitCount > 0); assert.ok(cases.every(item => item.status === 'passed'));
assert.deepEqual([units.numPassedTests, units.numFailedTests, units.numPendingTests], [unitCount, 0, 0]);
const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {};
let sourceManifest;
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0); noApproval(report);
  const manifest = await verifyRef(report.sourceManifest); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, report.sourceManifest.fileCount); await verifyInputs(manifest.files); requireInputs(manifest.files);
  await verifyInputs(report.checkInputs);
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest); else sourceManifest = report.sourceManifest;
  assert.deepEqual(report.tests, mode === 'unit' ? { passed: unitCount, failed: 0, skipped: 0 }
    : mode === 'browser' ? { passed: 1, failed: 0, skipped: 0, flaky: 0 } : null);
  runs[mode] = { ...await ref(file), tests: report.tests };
}
const earlierAttempts = [];
for (const mode of ['unit', 'static', 'browser']) {
  for (let number = 1; number < Number(attempts[mode].slice(1)); number++) {
    const attempt = 'a' + number, file = `${folder}/${mode}-${attempt}/result.json`;
    let report;
    try { report = await read(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); noApproval(report);
    // Retain each report and manifest by hash, without comparing historical
    // source bytes against current files or treating a prior failure as a pass.
    await verifyRef(report.sourceManifest);
    const reason = report.reportError ?? 'Earlier attempt retained unchanged; selected final validation is recorded separately.';
    earlierAttempts.push({ ...await ref(file), mode, attempt, pass: report.pass, tests: report.tests,
      sourceManifest: report.sourceManifest, supersededSource: report.sourceManifest.sha256 !== sourceManifest.sha256, reason });
  }
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.equal(path.basename(specs[0].file.replaceAll('\\', '/')), 'stand-inspection.spec.mjs');
const copies = attachments.filter(item => item.name === 'stand-inspection-source-evidence' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'stand-inspection.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true, key);
for (const key of ['productCameraControlsOnly', 'sameSceneAndSelection', 'orbitAccepted', 'opticalZoomControlsAccepted',
  'modelSwitchPreservesReturnView', 'escapeReturnsWithoutClosingEditor', 'cancelRestoresAppliedView',
  'localeAndViewportRetainInspection', 'inspectionDoesNotPersist']) assert.equal(app[key], true, key);
noApproval(app, ['artAccepted', 'childReviewed', 'installedNative', 'devicePerformanceAccepted', 'releaseReady']);
for (const key of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[key], []);
await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs);
assert.ok(app.observations && !Array.isArray(app.observations));
for (const name of ['baseline', 'draft', 'head', 'orbited', 'zoomed', 'whales', 'narrow', 'returned', 'cloud', 'cancelled']) {
  assert.ok(app.observations[name] && typeof app.observations[name] === 'object', name);
}
assert.ok(Array.isArray(app.preferenceOperations));
const appearanceKeys = new Set(['probpera-planet-composition-v1', 'probpera-planet-stand-v1', 'probpera-planet-background-v1', 'probpera.globe-edition.v2', 'probpera.globe-style.v1']);
assert.deepEqual(app.preferenceOperations.filter(item => item.operation !== 'get' && appearanceKeys.has(item.key)), []);
assert.deepEqual(app.customizationWrites, []);
assert.equal(app.screenshots.length, 3); assert.equal(new Set(app.screenshots.map(item => item.filename)).size, 3);
assert.deepEqual(app.screenshots.map(item => item.filename).sort(), ['stand-inspection-pushkin-ru-1440.png',
  'stand-inspection-whales-en-390.png', 'stand-inspection-whales-ru-1440.png']);
const images = app.screenshots.map(item => {
  assert.match(item.filename, /^[A-Za-z0-9_-]+\.png$/u);
  assert.equal(item.framing, 'actual-product-stand-inspection');
  return { path: path.join(path.dirname(actualAppCapture.path), item.filename), sha256: item.sha256 };
});
await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
assert.equal(normalized(visual.actualAppCapture.path), normalized(actualAppCapture.path)); assert.equal(visual.actualAppCapture.sha256, actualAppCapture.sha256);
noApproval(visual, ['artAccepted', 'childApproved', 'userRealismRequirementSatisfied', 'releaseReady']);
assert.equal(visual.images.length, 3); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, 3);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.ok(typeof image.reviewer === 'string' && image.reviewer.trim());
  assert.ok(Array.isArray(image.findings) && image.findings.length && image.findings.every(item => typeof item === 'string' && item.trim()));
  assert.ok(images.some(known => normalized(known.path) === normalized(image.path) && known.sha256 === image.sha256)); await verifyInputs([image]);
}

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
const buildAudits = [];
for (const [kind, file] of [['pwa', folder + '/pwa-a1/strict-audit.json'], ...Object.entries(android.checks).filter(([key]) => ['strictRuntimeAudit', 'binaryAudit', 'build'].includes(key))]) {
  const audit = await read(file); assert.equal(audit.pass, true);
  const identity = kind === 'binaryAudit' ? audit.sourceArtifact : kind === 'build' ? audit : audit.identity;
  assert.equal(identity.sourceCommit, sourceCommit); assert.equal(identity.buildId, kind === 'pwa' ? pwa.buildId : android.buildId);
  if (kind === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); await verifyInputs([...audit.rawReports, audit.zip.ledger]); }
  buildAudits.push(await ref(file));
}
assert.equal(buildAudits.length, 4);
const copy = await read(folder + '/pwa-a1/copy-verification.json'); assert.equal(copy.pass, true); assert.equal(copy.files, pwa.artifact.files); assert.equal(copy.bytes, pwa.artifact.bytes);
assert.equal(copy.artifactManifest.sha256, pwa.artifact.artifactSha256); await verifyInputs([copy.detailedLedger, copy.artifactManifest]);
await verifyInputs([android.apk]); assert.equal((await fs.stat(android.apk.path)).size, android.apk.bytes);
for (const [reference, entryRef, buildId] of [[prior.pwa, entry.priorPwa, '2d550d2114a9a12a1221febd4e89a44c6c148f0be69767cdf960050d4f36f1be'],
  [prior.android, entry.priorAndroid, '0865c798c1c41da3ebe7a292d296abd6a9414ef3e89f09514159ce40aaa2f5be']]) {
  assert.deepEqual(reference, entryRef); const old = await verifyRef(reference);
  assert.equal(old.pass, true); assert.equal(old.buildId, buildId); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// Preflight every document and prepare every replacement before any state write.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S13');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const expectedStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s13BookCloudStand.path, entry.previous); await verifyRef(state.verificationCache.s13BookCloudStand);
assert.equal(state.verificationCache.s13StandInspection, undefined);
const criterionIds = ['S13.CUSTOM-003'];
for (const id of criterionIds) assert.equal(stage.criteria.find(item => item.id === id).status, 'IN_PROGRESS');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s13-stand-inspection-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D146:/gmu)].length, 1); assert.equal(/^- D147:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const limitations = ['Stand inspection is a transient adult view and does not commit appearance or grant access.',
  'Same-scene close inspection and return are scoped behavior, not full accessory/audio composition or installed-device acceptance.',
  'Chrome executes the actual application source with controlled native ports; installed-device behavior is not established.',
  'Historical Starter Set counts remain bound to the earlier inventory; changed integration inputs are explicit and no new whole-inventory claim is made.'];
const nextAction = 'Continue the full application plan from the next bounded internal requirement. Preserve transient stand inspection, existing camera ownership, return navigation, appearance draft and all established geometry, reader, locale and storage behavior. Continue remaining Starter Set/source bindings and functional gaps without repeating unchanged geometry suites. Child/rights/art/lightmap review, full accessories/audio/catalog, screen-reader, installed-device/stress, actual storage retention, distributed sync/conflict resolution, iOS and release gates remain open.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'STAND_INSPECTION_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, earlierAttempts, runs, sourceManifest, unitCount, unitFiles, browserCases: 1,
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryHistorical: true, inventoryReusedWithCurrentInputsVerified: false,
  inventoryUnchangedInputsVerified: true, inventoryChangedInputs, inventoryAuditRerun: false,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 }, ownerAdditionIds: prior.ownerAdditionIds,
  preservedInputs: entry.preservedInputs, changedInputsBefore: entry.changedInputsBefore,
  priorVisualReview: prior.visualReview, priorSceneVisualReview: prior.priorSceneVisualReview,
  priorArtReview: prior.priorArtReview, priorArtCapture: prior.priorArtCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD147Recorded: true, criteriaUpdated: criterionIds, criterionChanges: [], stageAndCriterionStatusesUnchanged: true,
  limitations, priorStorageLimitations: prior.priorStorageLimitations, inheritedReadingLibraryLimitations: prior.inheritedReadingLibraryLimitations,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true, installedNativeDevice: false,
  productCameraControlsOnly: true, inspectionDoesNotPersist: true, appearancePreferenceWrites: false,
  geometryRerun: false, unchangedGeometrySuitesRerun: false,
  newActualAppCapture: true, isolatedArtCapture: false, artAccepted: false,
  likenessAccepted: false, userRealismRequirementSatisfied: false, childApproval: false, rightsApproval: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const id of criterionIds) {
  const criterion = stage.criteria.find(item => item.id === id); push(criterion.evidence, resultPath);
  criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt;
  criterion.notes += ` A transient adult Inspect stand action uses the existing camera rig to approach and orbit the displayed stand, then restore the prior view without committing appearance. ${unitCount} cases across three selected math/camera/UI-controller suites, TypeScript and one actual-App Chrome case with controlled native ports bind return/cancel behavior, inspected RU/EN views and local PWA/Android artifacts. Thirty-six geometry/material/composition/reader/locale/storage inputs remain unchanged. Historical Starter Set inventory retains 29/13/0 plus three owner additions with changed integration hashes listed explicitly. Full composition, screen-reader, art and installed-device acceptance remain open.`;
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S13 stand inspection: ${unitCount} cases across three selected math/camera/UI-controller suites, TypeScript, one actual-App Chrome case and exact local PWA/Android builds. Thirty-six established inputs including all geometry/material factories and seven composition owners remain unchanged. Historical Starter Set inventory remains 29/13/0 plus three owner additions with explicit changed integration bindings. No geometry or inventory audit rerun; child/rights/art, full catalog/stress and installed-device acceptance remain open.`);
state.verificationCache.s13StandInspection = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
const decision = `\n- D147: Add transient adult stand inspection through the existing scene and camera rig, preserving the appearance draft and restoring navigation without saving a composition. Source ${sourceCommit} has ${unitCount} cases across three selected math/camera/UI-controller suites, TypeScript, one actual-App Chrome case with controlled native ports, three inspected RU/EN images, and local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. S13.CUSTOM-003 receives scoped evidence only; all criterion and stage statuses stay unchanged. Thirty-six established inputs, all geometry/material factories and seven composition owners are retained. Starter Set inventory is historical 29/13/0 plus three owner additions with changed integration hashes explicit; no current whole-inventory claim is made. Child/rights/art/lightmap, full composition/catalog/stress, screen-reader, installed-device and release gates remain open. Evidence: evidence/S13/stand-inspection-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds transient adult stand inspection and return through the existing camera rig, without an appearance save.\n${unitCount} cases across three selected suites, TypeScript, one actual-App Chrome case and one PWA offline smoke pass. Three RU/EN images are inspected evidence, not formal art or child approval; native ports remain controlled.\nS13.CUSTOM-003 receives evidence only; all criterion and stage statuses remain unchanged. Thirty-six established runtime sources are retained. Historical Starter Set inventory is 29/13/0 plus three owner additions, with changed integration hashes explicit.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S13/stand-inspection-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s13-stand-inspection-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalDocs.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, counts, firstOpen: 'S03', criterionChanges: result.criterionChanges, stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
