import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Finalize a source-bound local checkpoint after selected checks, fresh inventory
// and preserved builds. All evidence is verified before updating persisted state.
// Usage: node checkpoint.mjs <source40> <unitAttempt> <staticAttempt> <browserAttempt> [pwaAttempt=a1] [androidAttempt=a1]
// Attempt arguments are bare aN labels, not folder names. No test/build is run here.
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, pwaAttempt = 'a1', androidAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt, pwaAttempt, androidAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const normalize = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalize(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/scene-inspection-20260920';
const priorFolder = 'docs/mobile/evidence/S13/writer-study-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-si';
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const required = ['src/host/planetSceneInspection.ts', 'src/host/planetSceneInspectionBridge.ts',
  'src/host/PlanetSceneInspectionControls.tsx', 'src/host/PlanetSceneInspectionControls.css',
  'src/components/GlobeSceneInspectionAnchor.tsx', 'src/components/GlobeIncludedBackground.tsx',
  'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx', 'src/App.tsx'];
const requireInputs = inputs => { for (const file of required) assert.ok(inputs.some(input => input.path === file), file); };
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  assert.equal(new Set(inputs.map(input => input.path)).size, inputs.length);
  for (const input of inputs) { assert.match(input.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'tests/pwa/globe-scene-inspection.spec.mjs',
    'scripts/mobile', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(priorFolder + '/result.json');
assert.equal(entry.stage, 'S13'); assert.equal(entry.previous, priorFolder + '/result.json');
assert.equal(entry.checkpoint, '6a577138db6fe0553eebb5d66fa4084f521b426b');
for (const flag of ['artAccepted', 'childApproved', 'releaseReady', 'productionActionsPerformed']) assert.equal(entry[flag], false);
await verifyInputs(entry.immutableAndPreservedInputs);
assert.equal(prior.pass, true); assert.equal(prior.sourceCommit, '1b7f85e1d7569937d8a16def2225d2f563067459');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems, prior.ownerAddedCount], [29, 12, 0, 3]);
await verifyInputs(prior.preservedCompositionInputs);
// Preserve every previous geometry/material source, including the final reduced
// ceramic saucer. App/renderer adapters intentionally changed in this slice.
const priorVisual = await verifyRef(prior.visualReview);
const preservedArtInputs = priorVisual.sourceInputs.filter(input => /^src\/components\/globe(?:WriterStudy|CeramicPortraitStand|WhaleStand|Antique|Stand|Library|LibraryBook)Geometry\.ts$/u.test(input.path)
  || ['src/components/globeCraftMaterials.ts', 'src/components/globeTurnedWoodAtlas.ts'].includes(input.path));
assert.equal(preservedArtInputs.length, 9); await verifyInputs(preservedArtInputs);

const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {}, reports = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.execution.exitCode, 0); assert.deepEqual(report.reportErrors, []);
  for (const flag of ['artAccepted', 'childApproved', 'installedDevice', 'releaseReady']) assert.equal(report[flag], false);
  await verifyInputs(report.sourceInputs); requireInputs(report.sourceInputs);
  if (mode === 'unit') { assert.deepEqual([report.tests.passed, report.tests.failed, report.tests.skipped], [3, 0, 0]); assert.deepEqual(report.tests.failures, []); }
  if (mode === 'static') assert.equal(report.tests, null);
  if (mode === 'browser') { assert.deepEqual([report.tests.passed, report.tests.failed, report.tests.skipped, report.tests.flaky], [1, 0, 0, 0]); assert.deepEqual(report.tests.errors, []); }
  reports[mode] = report; runs[mode] = { ...await ref(file), tests: report.tests, execution: report.execution };
}
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath);
assert.equal(inventory.auditValid, true); await verifyInputs(inventory.sourceInputs);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
const priorInventory = await verifyRef(prior.starterSetSourceInventory);
assert.deepEqual(inventory.items.map(item => item.id), priorInventory.items.map(item => item.id));
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), priorInventory.ownerAdditions.map(item => item.id).sort());
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }
assert.equal(inventory.items.find(item => item.id === 'background.base.writer-study')?.requirementId, 'STARTER-012');

const browserJson = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [];
const visit = suite => { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); for (const child of suite.suites ?? []) visit(child); };
for (const suite of browserJson.suites) visit(suite);
const appAttachments = attachments.filter(item => item.name === 'scene-inspection-source-evidence' && item.path);
assert.equal(appAttachments.length, 1);
const outputRoot = `${artifacts}/browser-${browserAttempt}`, originals = [];
for (const child of await fs.readdir(outputRoot, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false);
  if (!child.isDirectory()) continue;
  const candidate = path.join(outputRoot, child.name, 'globe-scene-inspection.json');
  try { if ((await fs.stat(candidate)).isFile()) originals.push(candidate); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1, 'Exactly one original testInfo.outputPath capture is required');
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(appAttachments[0].path);
assert.ok(normalize(browserAttachment.path).startsWith(normalize(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(browserAttachment.path)).equals(await fs.readFile(actualAppCapture.path)), 'Copied attachment differs from the original capture');
const app = await read(actualAppCapture.path);
assert.equal(app.pass, true); assert.equal(app.actualApp, true); assert.equal(app.inspectionPersisted, false);
for (const name of ['errors', 'missingResources', 'externalRequests']) assert.deepEqual(app[name], []);
const observations = app.observations;
assert.ok(observations && typeof observations === 'object' && !Array.isArray(observations));
for (const name of ['baseline', 'blocked', 'economy', 'resumed', 'finished']) {
  assert.equal(observations[name].backgroundId, 'background.base.writer-study');
  assert.equal(observations[name].standId, 'stand.base.portrait-tolstoy');
  assert.equal(observations[name].surfaceCount, 1); assert.equal(observations[name].sameScene, true);
}
assert.ok(observations.collection.bookKey && observations.collection.bookTitle && observations.collection.visibleCanonicalCards > 0);
assert.equal(observations.projected.marker.visible, true); assert.equal(observations.projected.marker.hit, true);
const protectedKeys = ['probpera-planet-composition-v1', 'probpera.globe-edition.v2', 'probpera.globe-style.v1', 'probpera-planet-stand-v1', 'probpera-planet-background-v1'];
assert.deepEqual(app.preferenceOperations.filter(operation => operation.operation !== 'get' && protectedKeys.includes(operation.key)), []);
const capturedImages = [];
for (const name of ['object-ru-1440', 'object-en-1440', 'object-en-390', 'marker-en-1440']) {
  capturedImages.push(await ref(path.join(path.dirname(actualAppCapture.path), `scene-inspection-${name}.png`)));
}
// Image hashes establish capture provenance only. No "inspected" or art approval
// is generated from a file listing or a green browser result.
let visualReview = null;
const visualPath = folder + '/visual-review.json';
let visual;
try { visual = await read(visualPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (visual !== undefined) {
  assert.ok(visual && typeof visual === 'object' && !Array.isArray(visual));
  assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit);
  for (const flag of ['artAccepted', 'childApproved', 'releaseReady']) assert.equal(visual[flag], false);
  await verifyInputs(visual.sourceInputs); requireInputs(visual.sourceInputs);
  assert.ok([actualAppCapture.path, browserAttachment.path].some(file => normalize(file) === normalize(visual.actualAppCapture.path)));
  assert.equal(visual.actualAppCapture.sha256, actualAppCapture.sha256); await verifyInputs([visual.actualAppCapture]);
  assert.equal(visual.images.length, capturedImages.length);
  assert.equal(new Set(visual.images.map(image => normalize(image.path))).size, capturedImages.length);
  for (const image of visual.images) {
    assert.equal(image.inspected, true); assert.ok(typeof image.reviewer === 'string' && image.reviewer.trim());
    assert.ok((typeof image.findings === 'string' && image.findings.trim()) || (Array.isArray(image.findings) && image.findings.length > 0));
    assert.ok(capturedImages.some(capture => normalize(capture.path) === normalize(image.path) && capture.sha256 === image.sha256));
    await verifyInputs([image]);
    // Optional prior-run provenance must prove byte identity, not just declare it.
    if (image.inspectedSource) { await verifyInputs([image.inspectedSource]); assert.equal(image.inspectedSource.sha256, image.sha256); }
  }
  visualReview = await ref(visualPath);
}

const pwaPath = `${folder}/pwa-${pwaAttempt}/result.json`, androidPath = `${folder}/android-${androidAttempt}/result.json`;
const pwa = await read(pwaPath), android = await read(androidPath);
for (const record of [pwa, android]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  assert.equal(record.releaseReady, false); assert.equal(record.stageAccepted, false); assert.equal(record.productionActionsPerformed, false);
  assert.ok(normalize(record.artifact.path).startsWith(artifacts + '/'));
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
for (const [record, hash] of [[pwa, pwa.artifact.artifactSha256], [android, android.artifact.sha256]]) {
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: hash });
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256); await verifyInputs(manifest.sourceInputs.files); requireInputs(manifest.sourceInputs.files);
}
const pwaAudit = await read(`${folder}/pwa-${pwaAttempt}/strict-audit.json`);
assert.equal(pwaAudit.pass, true); assert.equal(pwaAudit.identity.sourceCommit, sourceCommit); assert.equal(pwaAudit.identity.buildId, pwa.buildId);
for (const name of ['strictRuntimeAudit', 'binaryAudit', 'build']) {
  const audit = await read(android.checks[name]); assert.equal(audit.pass, true);
  if (name === 'strictRuntimeAudit') { assert.equal(audit.identity.sourceCommit, sourceCommit); assert.equal(audit.identity.buildId, android.buildId); }
  if (name === 'build') { assert.equal(audit.sourceCommit, sourceCommit); assert.equal(audit.buildId, android.buildId); }
  if (name === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); assert.equal(audit.sourceArtifact.sourceCommit, sourceCommit); assert.equal(audit.sourceArtifact.buildId, android.buildId); }
}
await verifyInputs([android.apk]); assert.equal((await fs.stat(android.apk.path)).size, android.apk.bytes);
const priorPwa = await verifyRef(prior.pwa), priorAndroid = await verifyRef(prior.android);
assert.equal(priorPwa.buildId, '1dbc005c9f07b1d133846f9549e4a19c460741709a57dc7cd5d618bec5342495');
assert.equal(priorAndroid.buildId, '524a40b7b7b180d64953257dad4002d92ffd8ff7eb242b560d331c84dd81b756');
for (const [record, hash] of [[priorPwa, priorPwa.artifact.artifactSha256], [priorAndroid, priorAndroid.artifact.sha256]]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, prior.sourceCommit);
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: hash });
  assert.equal(manifest.sourceCommit, prior.sourceCommit); assert.equal(manifest.buildId, record.buildId);
}
await verifyInputs([priorAndroid.apk]);

// Build the entire update in memory. No state, decision, note or result is
// written until every input and all destination preconditions have passed.
const globalPaths = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const original = new Map(await Promise.all(globalPaths.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(original.get(globalPaths[0])), stage = state.stages.find(item => item.id === 'S13');
const statuses = state.stages.map(item => ({ id: item.id, status: item.status, criteria: item.criteria.map(criterion => [criterion.id, criterion.status]) }));
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.deepEqual(state.verificationCache.s13WriterStudy.path, entry.previous); await verifyRef(state.verificationCache.s13WriterStudy);
const criteria = ['S13.CUSTOM-003', 'S13.CUSTOM-006', 'S13.CUSTOM-007'];
for (const id of criteria) assert.equal(stage.criteria.find(item => item.id === id)?.status, 'IN_PROGRESS');
const decisions = original.get(globalPaths[1]), marker = '<!-- s13-scene-inspection-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D139:/gmu)].length, 1); assert.equal(/^- D140:/mu.test(decisions), false);
for (const file of globalPaths.slice(2)) assert.equal(original.get(file).includes(marker), false, file);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const nextAction = 'Continue the full application plan with the transient adult manuscript interaction preserved. Keep the one scene, unchanged composition owner, writer-study geometry, golden whales, 984-book library and final one-third-reduced ceramic saucers. Refine remaining visible realism; extend only the next bounded catalog/interaction requirement. Formal screen-reader/device coverage, child ages 10–17 review, full catalog/accessories/audio, art/lightmaps, iOS and release acceptance remain open. Avoid repeating valid checks of unchanged inputs.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'TRANSIENT_MANUSCRIPT_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), priorWriterStudy: await ref(entry.previous), attempts, runs,
  starterSetSourceInventory: await ref(inventoryPath), preservedInputs: entry.immutableAndPreservedInputs, preservedArtInputs,
  preservedCompositionInputs: prior.preservedCompositionInputs, retainedLibraryDensity: prior.retainedLibraryDensity,
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages, visualReview,
  captureMeaning: visualReview ? 'Captured bytes and separately recorded scoped inspection; no art approval.'
    : 'Source-bound captured bytes; this record does not assert independent visual inspection or art approval.',
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  priorPwa: prior.pwa, priorAndroid: prior.android, requiredStarterItems: 29, sourceBoundStarterItems: 12, acceptedStarterItems: 0,
  ownerAddedCount: 3, ownerAdditions: inventory.ownerAdditions, decisionD140Recorded: true, inspectionPersisted: false,
  controlledNativePorts: true, actualSceneRenderedInChrome: true, installedNativeDevice: false, iosCompiled: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, artAccepted: false, childApproval: false, rightsApproval: false,
  userRealismRequirementSatisfied: false, grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const file of [folder + '/entry.json', resultPath, inventoryPath, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
if (visualReview) push(stage.artifacts, visualReview.path);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
const notes = {
  'S13.CUSTOM-003': ' Transient adult manuscript inspection retains the same scene and saved composition; explicit literary navigation closes inspection first. No new persistence owner or camera remount is introduced.',
  'S13.CUSTOM-006': ' Actual shown-resource readiness gates the projected paper marker and keyboard alternative. Replaced targets, backgrounding and blocked contexts cannot authorize stale actions; child review remains open.',
  'S13.CUSTOM-007': ' Three selected controller cases, TypeScript and one actual Chrome interaction case bind the final source and preserved PWA/Android artifacts. Keyboard/modal focus and RU/EN behavior have scoped evidence; formal screen-reader/device/art acceptance remains open.',
};
for (const criterion of stage.criteria.filter(item => criteria.includes(item.id))) { push(criterion.evidence, resultPath); criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += notes[criterion.id]; }
push(state.stages.find(item => item.id === 'S12').artifacts, inventoryPath);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction;
push(state.resume.contextFiles, resultPath); push(state.resume.doNotRepeat, 'S13 transient manuscript inspection: only the three selected controller cases, final TypeScript/Chrome interaction evidence and preserved source-bound PWA/Android builds are green. Unrelated suites were not rerun or counted; art, child, screen-reader and installed-device acceptance remain open.');
state.verificationCache.s13SceneInspection = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(item => ({ id: item.id, status: item.status, criteria: item.criteria.map(criterion => [criterion.id, criterion.status]) })), statuses);
const decision = `\n- D140: Add transient adult manuscript inspection to the existing writer study, using the actual decorative paper geometry for a projected DOM marker and a keyboard alternative. Keep mesh picking disabled and retain the current scene, camera, composition record, original geometry and final one-third-reduced ceramic saucers. The localized modal returns to scene inspection before leaving it; explicit literary navigation closes inspection. Source ${sourceCommit} has three selected controller cases, TypeScript and one scoped actual-Chrome interaction case, with preserved PWA ${pwa.buildId.slice(0, 8)} and Android/dev ${android.buildId.slice(0, 8)}. Inventory stays 29 required / 12 source-bound / zero accepted, plus three owner additions. These checks do not grant art, realism, screen-reader, child ages10-17, installed-device or release acceptance. Evidence: evidence/S13/scene-inspection-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds transient adult manuscript inspection to the existing writer study.\nThree controller cases, TypeScript and one actual Chrome case pass; unrelated suites are not counted.\nThe source-bound captures and local builds do not establish art, child, screen-reader or installed-device acceptance.\nInventory remains 29 required, 12 source-bound, zero accepted, plus three separate owner-added portrait stands.\nPWA ${pwa.buildId.slice(0, 8)}; Android/dev ${android.buildId.slice(0, 8)}; APK SHA256 ${android.apk.sha256}.\nEvidence: evidence/S13/scene-inspection-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s13-scene-inspection-20260920:end -->\n\n`;
const updates = new Map([[globalPaths[0], json(state)], [globalPaths[1], decisions + decision], ...globalPaths.slice(2).map(file => [file, note + original.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, previous] of original) assert.equal(await fs.readFile(file, 'utf8'), previous, `${file}: changed during preflight`);
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, attempts, pwa: pwa.buildId, android: android.buildId, counts, firstOpen: 'S03', stageStatusesUnchanged: true, releaseReady: false }));
