import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Explicit attempts prevent accidentally checkpointing an earlier green run.
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9]\d*$/u);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/library-lighting-20260919';
const priorFolder = 'docs/mobile/evidence/S13/composition-20260919';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const ref = async filename => ({ path: filename, sha256: sha(await fs.readFile(filename)) });
const verifyInputs = async inputs => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  for (const input of inputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
};
const attempts = Object.freeze({ unit: unitAttempt, static: staticAttempt, browser: browserAttempt });
const runs = {};
for (const [name, attempt] of Object.entries(attempts)) {
  const filename = `${folder}/${name}-${attempt}/result.json`;
  const record = await read(filename);
  assert.equal(record.pass, true, filename);
  assert.equal(record.sourceInputsUnchanged, true, filename);
  assert.ok(record.executions.length > 0 && record.executions.every(execution => execution.exitCode === 0), filename);
  await verifyInputs(record.sourceInputs);
  if (name !== 'static') {
    assert.ok(Number.isSafeInteger(record.tests.passed) && record.tests.passed > 0, filename);
    assert.deepEqual([record.tests.failed, record.tests.skipped], [0, 0], filename);
  }
  if (name === 'browser') {
    assert.equal(record.tests.flaky, 0);
    assert.deepEqual(record.tests.errors, []);
  }
  runs[name] = { ...await ref(filename), tests: record.tests };
}
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S13');
assert.equal(entry.artAccepted, false);
assert.equal(entry.previousComposition, priorFolder + '/result.json');
await verifyInputs(entry.dependencies);

// Prior composition remains historical evidence. Only the unchanged core and
// art inputs are newly inspected; previous imagery remains historical evidence.
const prior = await read(entry.previousComposition);
assert.equal(prior.pass, true);
assert.equal(prior.sourceCommit, '69ad06c201cc8a62ffef4f4ec4daaf117b457c15');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
assert.equal(sha(await fs.readFile(prior.starterSetSourceInventory.path)), prior.starterSetSourceInventory.sha256);
assert.equal(entry.previousArt, prior.preservedVisualReview.path);
assert.equal(sha(await fs.readFile(prior.preservedVisualReview.path)), prior.preservedVisualReview.sha256);
assert.equal(sha(await fs.readFile(prior.runs.browser.path)), prior.runs.browser.sha256);
const previousBrowser = await read(prior.runs.browser.path);
assert.equal(previousBrowser.pass, true);
assert.equal(previousBrowser.sourceInputsUnchanged, true);
const preservedCompositionInputs = [];
for (const pathname of [
  'src/planet/globeComposition.ts', 'src/host/planetComposition.ts',
  'src/host/planetCompositionPresentation.ts', 'src/components/useGlobeCompositionScene.ts',
  'src/components/useGlobeCompositionFrame.ts', 'src/components/globeAtlas.ts',
  'src/components/useGlobeStyleState.ts',
]) {
  const input = previousBrowser.sourceInputs.find(value => value.path === pathname);
  assert.ok(input, pathname);
  assert.equal(sha(await fs.readFile(pathname)), input.sha256, pathname);
  preservedCompositionInputs.push(input);
}
let inventoryReference = prior.starterSetSourceInventory;
const inventoryPath = folder + '/starter-set-source-inventory.json';
let currentInventory = null;
try { currentInventory = await read(inventoryPath); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (currentInventory !== null) {
  assert.equal(currentInventory.auditValid, true);
  assert.deepEqual([currentInventory.requiredCount, currentInventory.sourceBoundCount, currentInventory.acceptedCount], [29, 11, 0]);
  await verifyInputs(currentInventory.sourceInputs);
  inventoryReference = await ref(inventoryPath);
}
const visualPath = folder + '/visual-review.json';
const visual = await read(visualPath);
assert.equal(visual.pass, true);
assert.equal(visual.artAccepted, false);
await verifyInputs(visual.sourceInputs);
for (const pathname of ['src/components/globeLibraryGeometry.ts', 'src/components/globeCraftMaterials.ts', 'src/components/globeStandGeometry.ts']) assert.ok(visual.sourceInputs.some(input => input.path === pathname), pathname);

const pwa = await read(folder + '/pwa-a1/result.json');
const android = await read(folder + '/android-a1/result.json');
for (const record of [pwa, android]) {
  assert.equal(record.pass, true);
  assert.equal(record.sourceCommit, sourceCommit);
  assert.match(record.buildId, /^[a-f0-9]{64}$/u);
}
assert.equal(pwa.artifact.exactCopiesVerified, true);
assert.equal(android.checks.exactCopiedBytes, true);
assert.ok((await fs.stat(pwa.artifact.path)).isDirectory());
assert.ok((await fs.stat(android.artifact.path)).isDirectory());
const pwaManifestBytes = await fs.readFile(pwa.artifact.path + '/artifact.json');
const androidManifestBytes = await fs.readFile(android.artifact.path + '/artifact.json');
assert.equal(sha(pwaManifestBytes), pwa.artifact.artifactSha256);
assert.equal(sha(androidManifestBytes), android.artifact.sha256);
for (const [manifest, record] of [[JSON.parse(pwaManifestBytes), pwa], [JSON.parse(androidManifestBytes), android]]) {
  assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceCommit, sourceCommit);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files);
}
assert.equal(sha(await fs.readFile(android.apk.path)), android.apk.sha256);

// Preflight every input before changing persistent state or notes.
const statePath = 'docs/mobile/AUTOPILOT_STATE.json';
const state = await read(statePath);
const statuses = state.stages.map(stage => [stage.id, stage.status]);
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status =>
  [status, state.stages.filter(stage => stage.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 });
assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(stage => stage.status !== 'COMPLETE').id, 'S03');
const stage = state.stages.find(value => value.id === 'S13');
assert.equal(stage.status, 'IN_PROGRESS');
const criterionIds = ['S13.CUSTOM-001', 'S13.CUSTOM-003', 'S13.CUSTOM-006', 'S13.CUSTOM-007'];
for (const id of criterionIds) assert.equal(stage.criteria.find(value => value.id === id)?.status, 'IN_PROGRESS', id);
const decisions = await fs.readFile('docs/mobile/DECISIONS.md', 'utf8');
const decisionCount = [...decisions.matchAll(/^- D134:/gmu)].length;
assert.ok(decisionCount <= 1, 'D134 must not be duplicated');
const marker = '<!-- s13-library-lighting-20260919:begin -->';
const noteFiles = new Map();
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const pathname = 'docs/mobile/' + name;
  const text = await fs.readFile(pathname, 'utf8');
  assert.equal(text.includes(marker), false, pathname);
  noteFiles.set(pathname, text);
}
await assert.rejects(fs.stat(folder + '/result.json'), { code: 'ENOENT' });
assert.equal(head(), sourceCommit);

const recordedAt = new Date().toISOString();
const nextAction = 'Preserve library architecture and book-placement density across lower quality tiers using economical compound true-3D geometry within existing budgets; see next-art-design.md and the remaining visual findings. Then continue the next bounded included scene or Starter Set implementation. Preserve source-aligned library lighting, occlusion, believable volume placement, inspected materials, physical stand UVs and the validated same-frame composition engine. Realistic quality remains subject to actual-App and close-up review, not a technical pass alone. Starter Set remains 11/29 source-bound with zero accepted. Full catalog/Background Studio, accessory/audio/child composition, formal art/certified lightmaps, rights/entitlements, installed-device budgets, iOS and release acceptance remain open. Do not repeat unchanged checks or prior artifact payload audits.';
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'INCLUDED_LIBRARY_AND_CRAFT_SURFACES_INSPECTED', pass: true,
  entry: await ref(folder + '/entry.json'), runs, attempts,
  priorComposition: await ref(entry.previousComposition), starterSetSourceInventory: inventoryReference,
  starterSetBindingsRefreshed: currentInventory !== null,
  previousArtReview: prior.preservedVisualReview, preservedCompositionInputs,
  visualReview: await ref(visualPath),
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  libraryLighting: {
    scope: 'included-library-and-shared-craft-materials', provenance: 'authored-in-project',
    sourceAlignedLightPlacement: true, windowDaylightAndCabinetOcclusion: true,
    deterministicVolumeGrouping: true, commonGlobeLightingOwnershipPreserved: true,
    standEnvelopePreserved: true, standSurfaceMappingInspected: true, sharedCraftMaterialsInspected: true, coreCompositionUnchanged: true,
    actualAppAndCloseupReviewRequired: true, certifiedLightmapApproval: false,
  },
  sourceBoundStarterItems: 11, requiredStarterItems: 29, acceptedStarterItems: 0,
  existingUserRealismRequirementPreserved: true, artAccepted: false,
  decisionD134Recorded: decisionCount === 1, rightsApproval: false, childApproval: false,
  controlledNativePorts: true, actualSceneRenderedInChrome: true,
  installedNativeDevice: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', visualPath, folder + '/pwa-a1/result.json', folder + '/android-a1/result.json']) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
const notes = {
  'S13.CUSTOM-001': ' The included library has source-aligned lighting, cabinet occlusion and more believable volume grouping, inspected in the actual app and close-ups. This library and shared-material slice adds no catalog IDs; inventory remains 11/29, zero accepted, with formal art/lightmap approval open.',
  'S13.CUSTOM-003': ' The improved library remains within the same scene and the unchanged validated included composition core. Prior transaction/rollback evidence remains historical and preserved; this lighting slice does not claim full accessory/audio/child composition or crash-safe persistence.',
  'S13.CUSTOM-006': ' Existing exact included composition compatibility and independent globe/camera ownership are retained. Library lighting and placement do not widen child, optional, rights or device authority.',
  'S13.CUSTOM-007': ' Scoped library geometry/material/light ownership, tier budgets and cleanup have current source-bound checks. Stand envelope and picking ownership are preserved; shared craft maps and stand surface mapping have current scoped checks. Installed-device performance and soak acceptance remain open.',
};
for (const criterion of stage.criteria.filter(value => criterionIds.includes(value.id))) {
  pushOnce(criterion.evidence, folder + '/result.json');
  criterion.commit = sourceCommit;
  criterion.lastValidatedAt = recordedAt;
  criterion.notes += notes[criterion.id];
}
if (currentInventory !== null) pushOnce(state.stages.find(value => value.id === 'S12').artifacts, inventoryPath);
state.updatedAt = recordedAt;
state.headSha = sourceCommit;
state.resume.nextAction = nextAction;
pushOnce(state.resume.contextFiles, folder + '/result.json');
pushOnce(state.resume.doNotRepeat, `S13 library-lighting-20260919 ${Object.entries(attempts).map(([mode, attempt]) => mode + '-' + attempt).join('/')} and matching visual/PWA/Android evidence cover scoped library lighting, occlusion and volume placement. Prior composition remains preserved; stand surface mapping has current scoped checks; 11/29 Starter Set items are source-bound, zero accepted. Technical checks do not settle realistic art quality, certified lightmaps, catalog/child/rights, device, iOS or release gates.`);
state.verificationCache.s13IncludedLibraryLighting = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(value => [value.id, value.status]), statuses);

const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} improves library light placement, window daylight,\nshelf/cabinet occlusion and believable grouping of books. Actual-App and close-up\nvisual review is bound to these source hashes; technical success alone does not\nsatisfy the user's realistic-quality requirement. Art acceptance and certified\nlightmap approval remain open. Stand geometry remains within the original bounds; physical surface mapping\nand materials have current visual review. Camera and core composition are preserved.\nFinal ${runs.unit.tests.passed} focused units, TypeScript and ${runs.browser.tests.passed} actual Chrome cases pass.\nEvidence: evidence/S13/library-lighting-20260919/result.json. PWA ${pwa.buildId.slice(0, 8)} and\nAndroid/dev ${android.buildId.slice(0, 8)} bind this source. APK SHA256: ${android.apk.sha256}.\nPrior composition and artifacts remain historical evidence. Starter Set remains\n11/29 source-bound, zero accepted. Full scene catalog/Background Studio, accessory\nand child composition, formal art/lightmaps, rights, installed-device budgets,\niOS and release remain open. Stage counts stay 3 complete, 11 in progress,\n27 unstarted; first open S03. Next: unresolved visual quality findings, then the next included scene/Starter\nSet requirement with actual-App and close-up inspection.\n<!-- s13-library-lighting-20260919:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(statePath, json(state));
for (const [pathname, previous] of noteFiles) await fs.writeFile(pathname, note + previous);
// D134 is proposed in README.md and is appended only by the coordinating owner.
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId,
  stageStatusesUnchanged: true, counts, firstOpen: 'S03', releaseReady: false }));
