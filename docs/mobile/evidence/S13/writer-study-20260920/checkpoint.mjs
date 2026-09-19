import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Preparation does not accept a stage. Only the owner runs this after the final
// source commit, inspection, focused checks and preserved local builds exist.
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const normalize = value => path.resolve(value).replaceAll('\\', '/');
const root = normalize(await fs.realpath('.'));
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/writer-study-20260920';
const priorFolder = 'docs/mobile/evidence/S13/ceramic-portraits-20260920';
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-ws';
const backgroundId = 'background.base.writer-study', requirementId = 'STARTER-012';
const ownerIds = ['pushkin', 'hemingway', 'tolstoy'].map(kind => 'stand.base.portrait-' + kind);
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const verifyInputs = async inputs => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  assert.equal(new Set(inputs.map(input => input.path)).size, inputs.length);
  for (const input of inputs) { assert.match(input.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path); }
};
const verifyRef = async reference => { await verifyInputs([reference]); return read(reference.path); };
const requiredInputs = ['src/components/globeWriterStudyGeometry.ts', 'src/components/globeBackgroundGeometry.ts',
  'src/components/GlobeIncludedBackground.tsx', 'src/planet/globeBackgrounds.ts', 'src/host/PlanetStandControls.tsx'];
const requireInputs = inputs => { for (const file of requiredInputs) assert.ok(inputs.some(input => input.path === file), file); };
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--', 'src', 'tests/pwa/globe-writer-study.spec.mjs',
    'scripts/mobile/audit-starter-set.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
cleanSource();
const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {}, reports = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = folder + '/' + mode + '-' + attempt + '/result.json', report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.pass, true); assert.equal(report.sourceInputsUnchanged, true);
  assert.equal(report.backgroundId, backgroundId); assert.equal(report.requirementId, requirementId);
  assert.deepEqual(report.reportErrors, []);
  assert.ok(report.executions.length > 0 && report.executions.every(item => item.exitCode === 0));
  await verifyInputs(report.sourceInputs); requireInputs(report.sourceInputs);
  if (mode !== 'static') assert.deepEqual([report.tests.failed, report.tests.skipped], [0, 0]);
  if (mode === 'unit') {
    assert.equal(report.tests.passed, 5); assert.deepEqual(report.tests.failures, []);
    assert.deepEqual(report.tests.selection.unitFiles, ['src/components/globeWriterStudyGeometry.test.ts', 'src/planet/globeWriterStudyPolicy.test.ts']);
    assert.deepEqual([report.tests.selection.expectedUnitCases, report.tests.selection.expectedAdapterCases], [3, 2]);
    assert.deepEqual(report.tests.selection.adapterFiles, ['src/host/HostPlatformServices.test.ts', 'src/platform/adapters/web/WebPlatformAdapter.test.ts']);
    assert.ok(Number.isSafeInteger(report.tests.filteredOut) && report.tests.filteredOut >= 0);
    assert.equal(report.tests.selectedAdapterCases.length, 2);
    assert.ok(report.tests.selectedAdapterCases.every(item => item.status === 'passed' && /confines the new background preference to its exact adult IDs and (?:browser )?key$/u.test(item.name)));
  }
  if (mode === 'browser') {
    assert.deepEqual([report.tests.passed, report.tests.flaky], [1, 0]); assert.deepEqual(report.tests.errors, []);
    assert.ok(report.sourceInputs.some(input => input.path === 'tests/pwa/globe-writer-study.spec.mjs'));
  }
  reports[mode] = report; runs[mode] = { ...await ref(file), tests: report.tests };
}
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S13'); assert.equal(entry.id, backgroundId); assert.equal(entry.requirementId, requirementId);
assert.equal(entry.requiredCount, 29); assert.equal(entry.catalogSceneId, 'writers-study-3d');
assert.equal(entry.artAccepted, false); assert.equal(entry.releaseReady, false);
assert.equal(entry.previous, priorFolder + '/result.json'); await verifyInputs(entry.dependencies);
const prior = await read(entry.previous);
assert.equal(prior.pass, true); assert.equal(prior.sourceCommit, '0d4a1c0bc119d8e637312f2041c9e1763671c1ca');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
const priorVisual = await verifyRef(prior.visualReview);
const preservedCompositionInputs = prior.preservedCompositionInputs;
assert.equal(preservedCompositionInputs.length, 7); assert.deepEqual(entry.preservedCompositionInputs, preservedCompositionInputs);
await verifyInputs(preservedCompositionInputs);
const preservedArtInputs = [];
for (const file of ['src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/LiteraryGlobe.tsx',
  'src/components/globeWhaleStandGeometry.ts', 'src/components/globeAntiqueGeometry.ts', 'src/components/globeCraftMaterials.ts',
  'src/components/globeTurnedWoodAtlas.ts', 'src/components/globeLibraryGeometry.ts', 'src/components/globeLibraryBookGeometry.ts']) {
  const input = priorVisual.sourceInputs.find(item => item.path === file); assert.ok(input, file);
  await verifyInputs([input]); preservedArtInputs.push(input);
}
assert.deepEqual(entry.preservedPortraitFactory, preservedArtInputs[0]);
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath);
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
await verifyInputs(inventory.sourceInputs);
const priorInventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.items.length, 29); assert.deepEqual(inventory.items.map(item => item.id), priorInventory.items.map(item => item.id));
const studyItem = inventory.items.find(item => item.id === backgroundId);
assert.equal(studyItem.requirementId, requirementId); assert.equal(studyItem.required, true); assert.equal(studyItem.iapSkuAllowed, false);
assert.equal(studyItem.implementation.status, 'source-present'); assert.equal(studyItem.acceptance, 'OPEN');
assert.equal(studyItem.releaseReady, false); requireInputs(studyItem.implementation.sources); await verifyInputs(studyItem.implementation.sources);
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), [...ownerIds].sort());
for (const item of inventory.ownerAdditions) {
  assert.equal(inventory.items.some(required => required.id === item.id), false);
  assert.equal(item.sourceItemId, item.id); assert.equal(item.canonicalSource, null); assert.equal(item.required, false);
  assert.equal(Object.hasOwn(item, 'requirementId'), false); assert.equal(item.inclusionBasis, 'explicit-owner-request');
  assert.equal(item.commercialAvailability, 'included-in-base'); assert.equal(item.supportedAccess, 'adult');
  for (const flag of ['iapSkuAllowed', 'childReviewed', 'rightsReviewed', 'artReviewed', 'grantsEntitlement', 'releaseReady']) assert.equal(item[flag], false);
  assert.equal(item.acceptance, 'OPEN'); await verifyInputs(item.implementation.sources);
}

const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit);
assert.equal(visual.artAccepted, false); assert.equal(visual.userRealismRequirementSatisfied, false);
await verifyInputs(visual.sourceInputs); requireInputs(visual.sourceInputs);
const actualApp = await verifyRef(visual.actualAppCapture), art = await verifyRef(visual.artCapture);
assert.ok(normalize(visual.actualAppCapture.path).startsWith(artifactRoot + '/browser-' + browserAttempt + '/'));
assert.equal(path.basename(visual.actualAppCapture.path), 'globe-writer-study.json');
assert.match(normalize(visual.artCapture.path), /\/s13-ws\/art-a[1-9][0-9]*\/result\.json$/u);
assert.equal(actualApp.pass, true); assert.equal(actualApp.actualApp, true);
for (const key of ['errors', 'missingResources', 'externalRequests']) assert.deepEqual(actualApp[key], []);
assert.deepEqual(visual.actualAppObservations, actualApp.observations);
assert.equal(art.sourceInputsUnchanged, true); assert.deepEqual(art.errors, []); await verifyInputs(art.sourceInputs);
assert.ok(art.sourceInputs.some(input => input.path === requiredInputs[0]));
for (const input of [...reports.browser.sourceInputs, ...art.sourceInputs])
  assert.equal(visual.sourceInputs.find(item => item.path === input.path)?.sha256, input.sha256, input.path);
const browserJson = await read(folder + '/browser-' + browserAttempt + '/playwright.json');
const attachments = [];
const visit = suite => { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); for (const child of suite.suites ?? []) visit(child); };
for (const suite of browserJson.suites) visit(suite);
// Playwright copies attached files into its attachments directory. Bind the
// actual copied bytes instead of assuming it records the original filename.
const appAttachments = attachments.filter(item => item.name === 'writer-study-source-evidence'
  && item.contentType === 'application/json' && item.path);
assert.equal(appAttachments.length, 1);
assert.ok(normalize(appAttachments[0].path).startsWith(artifactRoot + '/browser-' + browserAttempt + '/'));
assert.equal(sha(await fs.readFile(appAttachments[0].path)), visual.actualAppCapture.sha256);
const observations = visual.actualAppObservations, priorDensity = prior.retainedLibraryDensity;
assert.ok(observations && typeof observations === 'object' && !Array.isArray(observations)); assert.equal(priorDensity.books, 984);
for (const name of ['baseline', 'cancelled']) {
  assert.equal(observations[name].backgroundId, 'background.base.library'); assert.deepEqual(observations[name].libraryDensity, priorDensity);
}
assert.deepEqual(observations.cancelled.backgroundResources, observations.baseline.backgroundResources);
for (const name of ['draft', 'translatedDraft', 'high', 'balanced', 'economy', 'narrow', 'restoredHigh', 'orbited', 'reloaded']) {
  const view = observations[name]; assert.equal(view.backgroundId, backgroundId);
  assert.equal(view.standId, 'stand.base.portrait-tolstoy'); assert.equal(view.surfaceCount, 1); assert.equal(view.backgroundCount, 1);
  assert.deepEqual(view.study.layers.map(layer => layer.name), ['writer-study-foreground', 'writer-study-midground', 'writer-study-background']);
  assert.ok(view.study.layers.every(layer => layer.meshes > 0 && layer.instances > 0 && layer.anchor.world.every(Number.isFinite)));
  assert.equal(view.study.landmarks.find(mesh => mesh.name === 'writer-study-book-page-blocks')?.instances, 192);
  assert.equal(view.study.landmarks.find(mesh => mesh.name === 'writer-study-window-glazing')?.instances, 2);
}
for (const tier of ['high', 'balanced', 'economy']) assert.equal(observations[tier].quality, tier);
assert.equal(art.frames.length, 7);
assert.deepEqual(art.frames.map(frame => frame.tier + ':' + frame.view).sort(),
  ['high:overview', 'high:desk', 'high:side', 'high:back', 'balanced:overview', 'economy:overview', 'economy:desk'].sort());
for (const frame of art.frames) {
  assert.equal(frame.groupName, 'included-globe-background:' + backgroundId);
  assert.equal(frame.transformedBounds.finite, true); assert.equal(frame.normals.finite, true); assert.equal(frame.normals.zeroNormals, 0);
  await verifyInputs([frame]);
}
assert.deepEqual(art.disposal.retired.map(owner => owner.key).sort(), ['study:high', 'study:balanced', 'study:economy'].sort());
assert.ok(art.disposal.retired.every(owner => owner.exactOnce && owner.ownedTextures.every(texture => texture.calls === 1)));
const expectedAppImages = ['preview-high-ru-1440', 'high-en-1440', 'balanced-en-1440', 'economy-en-1440',
  'economy-en-390', 'high-en-orbit-1440', 'reloaded-en-1440'].map(name => 'writer-study-' + name + '.png');
assert.equal(visual.images.length, art.frames.length + expectedAppImages.length);
assert.equal(new Set(visual.images.map(image => normalize(image.path))).size, visual.images.length);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.equal(typeof image.reviewer, 'string'); assert.ok(image.reviewer.length > 0);
  assert.equal(typeof image.actualApp, 'boolean'); await verifyInputs([image]);
  if (image.actualApp) {
    assert.equal(normalize(path.dirname(image.path)), normalize(path.dirname(visual.actualAppCapture.path)));
    assert.ok(expectedAppImages.includes(path.basename(image.path)));
  } else {
    assert.ok(art.frames.some(frame => normalize(frame.path) === normalize(image.path) && frame.sha256 === image.sha256));
  }
}
assert.equal(visual.images.filter(image => image.actualApp).length, expectedAppImages.length);

const pwa = await read(folder + '/pwa-a1/result.json'), android = await read(folder + '/android-a1/result.json');
for (const record of [pwa, android]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  assert.equal(record.releaseReady, false); assert.ok(normalize(record.artifact.path).startsWith(artifactRoot + '/'));
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
for (const [record, expectedHash] of [[pwa, pwa.artifact.artifactSha256], [android, android.artifact.sha256]]) {
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: expectedHash });
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files); requireInputs(manifest.sourceInputs.files);
}
await verifyInputs([android.apk]); assert.equal((await fs.stat(android.apk.path)).size, android.apk.bytes);
for (const name of ['strictRuntimeAudit', 'binaryAudit', 'build']) {
  const audit = await read(android.checks[name]); assert.equal(audit.pass, true);
  if (name === 'build') { assert.equal(audit.sourceCommit, sourceCommit); assert.equal(audit.buildId, android.buildId); }
  if (name === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); assert.equal(audit.sourceArtifact.buildId, android.buildId); assert.equal(audit.sourceArtifact.sourceCommit, sourceCommit); }
}
const priorPwa = await verifyRef(prior.pwa), priorAndroid = await verifyRef(prior.android);
for (const record of [priorPwa, priorAndroid]) { assert.equal(record.pass, true); assert.equal(record.sourceCommit, prior.sourceCommit); }
// Prior complete payload copies were already audited. Preserve their result,
// manifest and APK identities without hashing the old runtime payloads again.
for (const [record, expectedHash] of [[priorPwa, priorPwa.artifact.artifactSha256], [priorAndroid, priorAndroid.artifact.sha256]]) {
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: expectedHash });
  assert.equal(manifest.sourceCommit, prior.sourceCommit); assert.equal(manifest.buildId, record.buildId);
}
await verifyInputs([priorAndroid.apk]);

// All artifact/source/state preflight completes before the first write.
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(statePath);
const statuses = state.stages.map(stage => [stage.id, stage.status]);
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(stage => stage.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 });
assert.equal(state.currentStageId, 'S03'); assert.equal(state.stages.find(stage => stage.status !== 'COMPLETE').id, 'S03');
const stage = state.stages.find(stage => stage.id === 'S13'); assert.equal(stage.status, 'IN_PROGRESS');
const criterionIds = ['S13.CUSTOM-001', 'S13.CUSTOM-003', 'S13.CUSTOM-006', 'S13.CUSTOM-007'];
for (const id of criterionIds) assert.equal(stage.criteria.find(criterion => criterion.id === id)?.status, 'IN_PROGRESS');
const decisions = await fs.readFile('docs/mobile/DECISIONS.md', 'utf8');
assert.equal([...decisions.matchAll(/^- D139:/gmu)].length, 1, 'Owner-authored D139 must exist exactly once');
const marker = '<!-- s13-writer-study-20260920:begin -->', noteFiles = new Map();
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = 'docs/mobile/' + name, previous = await fs.readFile(file, 'utf8');
  assert.equal(previous.includes(marker), false, file); noteFiles.set(file, previous);
}
await assert.rejects(fs.stat(folder + '/result.json'), { code: 'ENOENT' }); cleanSource();
const recordedAt = new Date().toISOString();
const nextAction = "Continue the existing full application plan from the reviewed writer-study scene and preserve the single scene, composition lifecycle, current portrait heads, golden whales and 984-book library. Refine remaining visible material, lighting and furniture realism using source-bound images; this scoped implementation does not satisfy the maximum-realism requirement. Complete the manuscript hotspot with keyboard/screen-reader interaction and the catalog's age-10–17 child review before claiming those requirements. Starter Set now has 12 of 29 source-bound items and zero accepted, plus three separate owner additions. Full catalog, accessories/audio, art/lightmaps, child, installed-device budgets, iOS and release acceptance remain open; avoid repeating valid unchanged checks.";
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'WRITER_STUDY_BACKGROUND_SCOPED_INSPECTION', pass: true,
  entry: await ref(folder + '/entry.json'), priorCeramic: await ref(entry.previous), backgroundId, requirementId,
  catalogSceneId: entry.catalogSceneId, attempts, runs, starterSetSourceInventory: await ref(inventoryPath), visualReview: await ref(visualPath),
  preservedCompositionInputs, preservedArtInputs, priorVisualReview: prior.visualReview, retainedLibraryDensity: priorDensity,
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  requiredStarterItems: 29, sourceBoundStarterItems: 12, acceptedStarterItems: 0, ownerAddedCount: 3, ownerAdditions: inventory.ownerAdditions,
  decisionD139Recorded: true, deferredCatalogScope: entry.deferredCatalogScope,
  userRealismRequirementSatisfied: false, artAccepted: false, likenessAccepted: false, certifiedLightmaps: false,
  rightsApproval: false, childApproval: false, grantsEntitlement: false, controlledNativePorts: true,
  actualSceneRenderedInChrome: true, installedNativeDevice: false, iosCompiled: false, devicePerformanceAccepted: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', visualPath, inventoryPath, ...Object.values(runs).map(run => run.path), result.pwa.path, result.android.path]) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => 'node ' + folder + '/run-checks.mjs ' + mode + ' ' + attempt);
stage.lastGreenCommands.push('node ' + folder + '/run-pwa.mjs ' + sourceCommit, 'pwsh -File ' + folder + '/build-android.ps1 ' + sourceCommit, 'node ' + folder + '/preserve-android.mjs ' + sourceCommit);
const criterionNotes = {
  'S13.CUSTOM-001': ' STARTER-012 writer study has an original full-3D source binding: 12/29 mandatory items are source-bound, zero accepted; three owner-added portrait stands remain separate.',
  'S13.CUSTOM-003': ' Writer study uses the existing whole-composition prepare/render/apply/cancel/save lifecycle; cancellation retains the same library resources, stand and camera. Seven composition owners and existing art sources are preserved.',
  'S13.CUSTOM-006': ' Exact adult inclusion preserves unknown/child denial. Actual furniture and 192 book placements remain across High/Balanced/Economy; the previous 984-book library is retained. Hotspot and age-10–17 child review remain open.',
  'S13.CUSTOM-007': ' Three new writer-study units, two filtered adapter cases, TypeScript and one actual Chrome case bind inspected images and PWA/Android artifacts. Realism/art, full catalog and installed-device acceptance remain open.',
};
for (const criterion of stage.criteria.filter(item => criterionIds.includes(item.id))) {
  pushOnce(criterion.evidence, folder + '/result.json'); criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += criterionNotes[criterion.id];
}
pushOnce(state.stages.find(item => item.id === 'S12').artifacts, inventoryPath);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction;
pushOnce(state.resume.contextFiles, folder + '/result.json');
pushOnce(state.resume.doNotRepeat, 'S13 writer study: five selected unit/adapter cases, TypeScript, one actual Chrome case, inspected captures and preserved PWA/Android source-bound artifacts. Filtered-out cases are not passes. Keep the 984-book library, current portraits, gold whales and seven composition owners; realism, hotspot, child ages 10–17, devices and full catalog remain open.');
state.verificationCache.s13WriterStudy = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(item => [item.id, item.status]), statuses);
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds the original included Writer's study / Кабинет писателя\n(STARTER-012) through the existing single-scene composition lifecycle. Preview\ncancellation retains the library resources; quality changes retain the actual\nfurniture layout. Five selected unit/adapter cases, TypeScript and one actual\nChrome case pass; ${runs.unit.tests.filteredOut} unmatched adapter cases were excluded, not passed.\nInspected source-bound images are not art approval or satisfaction of the user's\nmaximum-realism requirement. Hotspot/accessibility, child ages 10–17, full catalog,\nlightmaps, installed devices, iOS and release acceptance remain open.\nPWA ${pwa.buildId.slice(0, 8)} and Android/dev ${android.buildId.slice(0, 8)} bind this source.\nAPK SHA256: ${android.apk.sha256}.\nEvidence: evidence/S13/writer-study-20260920/result.json.\nStarter Set: 12/29 source-bound, zero accepted, plus three separate owner additions.\nStages: 3 complete, 11 in progress, 27 unstarted; first open S03.\nNext: improve unresolved visible realism and continue the existing full app plan.\n<!-- s13-writer-study-20260920:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(statePath, json(state));
for (const [file, previous] of noteFiles) await fs.writeFile(file, note + previous);
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId, counts, firstOpen: 'S03', stageStatusesUnchanged: true, releaseReady: false }));
