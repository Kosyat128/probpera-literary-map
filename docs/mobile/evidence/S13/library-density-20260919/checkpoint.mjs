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
const folder = 'docs/mobile/evidence/S13/library-density-20260919';
const priorFolder = 'docs/mobile/evidence/S13/library-lighting-20260919';
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
assert.equal(entry.previousLighting, priorFolder + '/result.json');
await verifyInputs(entry.dependencies);

// Previous lighting/material evidence remains historical; density and reduced
// geometry need a new review. Unchanged stand/material/core sources stay bound.
const prior = await read(entry.previousLighting);
assert.equal(prior.pass, true);
assert.equal(prior.sourceCommit, '9b8952d73f664b16f78b045e5dfe53031711616e');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
assert.equal(sha(await fs.readFile(prior.starterSetSourceInventory.path)), prior.starterSetSourceInventory.sha256);
assert.equal(entry.previousArt, prior.visualReview.path);
assert.equal(sha(await fs.readFile(prior.visualReview.path)), prior.visualReview.sha256);
const previousVisual = await read(prior.visualReview.path);
assert.equal(previousVisual.pass, true);
assert.equal(previousVisual.artAccepted, false);
const preservedCompositionInputs = [];
for (const pathname of [
  'src/planet/globeComposition.ts', 'src/host/planetComposition.ts',
  'src/host/planetCompositionPresentation.ts', 'src/components/useGlobeCompositionScene.ts',
  'src/components/useGlobeCompositionFrame.ts', 'src/components/globeAtlas.ts',
  'src/components/useGlobeStyleState.ts',
]) {
  const input = prior.preservedCompositionInputs.find(value => value.path === pathname);
  assert.ok(input, pathname);
  assert.equal(sha(await fs.readFile(pathname)), input.sha256, pathname);
  preservedCompositionInputs.push(input);
}
const preservedStandAndCraftInputs = [];
for (const pathname of ['src/components/globeStandGeometry.ts', 'src/components/globeCraftMaterials.ts']) {
  const input = previousVisual.sourceInputs.find(value => value.path === pathname);
  assert.ok(input, pathname);
  assert.equal(sha(await fs.readFile(pathname)), input.sha256, pathname);
  preservedStandAndCraftInputs.push(input);
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
// Include any narrowly named library geometry helper introduced by this slice.
for (const name of await fs.readdir('src/components')) {
  if (!/^globeLibrary.*\.ts$/u.test(name) || name.endsWith('.test.ts')) continue;
  const pathname = 'src/components/' + name;
  assert.ok(visual.sourceInputs.some(input => input.path === pathname), pathname);
}

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
const decisionCount = [...decisions.matchAll(/^- D135:/gmu)].length;
assert.ok(decisionCount <= 1, 'D135 must not be duplicated');
const marker = '<!-- s13-library-density-20260919:begin -->';
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
const nextAction = 'Continue the realistic craft-material refinement identified by the inspected library and stand close-ups: natural irregular wood, credible leather/gilding and paper/metal finishes. Preserve the library layout and book-placement density across quality tiers, economical true-3D volumes, inspected lighting/materials, unchanged stands and the validated composition core. Realistic quality still needs actual-App and close-up review; a technical pass does not establish final art quality. Starter Set remains 11/29 source-bound with zero accepted. Full catalog/Background Studio, accessory/audio/child composition, formal art/certified lightmaps, rights/entitlements, installed-device budgets, iOS and release acceptance remain open. Do not repeat unchanged checks or prior artifact payload audits.';
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'INCLUDED_LIBRARY_TIER_DENSITY_INSPECTED', pass: true,
  entry: await ref(folder + '/entry.json'), runs, attempts,
  priorLighting: await ref(entry.previousLighting), priorComposition: prior.priorComposition,
  starterSetSourceInventory: inventoryReference,
  starterSetBindingsRefreshed: currentInventory !== null,
  previousArtReview: prior.visualReview, preservedCompositionInputs, preservedStandAndCraftInputs,
  visualReview: await ref(visualPath),
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  libraryDensity: {
    scope: 'included-library-geometry-only', provenance: 'authored-in-project',
    nominalLayout: { bays: 16, rowsPerBay: 8, slotsPerRow: 8 },
    lowerTiersRetainPlacementDensity: true, economicalCompoundTrue3DGeometry: true,
    lightingAndMaterialOwnershipPreserved: true, commonGlobeLightingOwnershipPreserved: true,
    standGeometryUnchanged: true, sharedCraftMaterialsUnchanged: true, coreCompositionUnchanged: true,
    actualAppAndCloseupReviewRequired: true, certifiedLightmapApproval: false,
  },
  sourceBoundStarterItems: 11, requiredStarterItems: 29, acceptedStarterItems: 0,
  existingUserRealismRequirementPreserved: true, artAccepted: false,
  decisionD135Recorded: decisionCount === 1, rightsApproval: false, childApproval: false,
  controlledNativePorts: true, actualSceneRenderedInChrome: true,
  installedNativeDevice: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', visualPath, folder + '/pwa-a1/result.json', folder + '/android-a1/result.json']) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
const notes = {
  'S13.CUSTOM-001': ' The included library retains its 16-bay/8-row/8-slot nominal layout and believable placement density at reduced tiers using economical true-3D geometry. No catalog IDs are added; inventory remains 11/29 source-bound, zero accepted, with final art/lightmap approval open.',
  'S13.CUSTOM-003': ' The denser reduced-tier library stays in the same scene with unchanged composition core, stand and craft-material sources. Prior transaction/rollback evidence remains historical and preserved; this geometry slice does not establish full accessory/audio/child composition or crash-safe persistence.',
  'S13.CUSTOM-006': ' Quality-tier changes retain the included library layout and current exact composition compatibility. Geometry simplification does not widen child, optional, rights or installed-device authority.',
  'S13.CUSTOM-007': ' Economical compound library volumes preserve layout while reducing per-volume geometry detail. Current source-bound budget/disposal checks and tier views accompany the change. Unchanged stand/craft/core inputs are verified; installed-device performance and soak remain open.',
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
pushOnce(state.resume.doNotRepeat, `S13 library-density-20260919 ${Object.entries(attempts).map(([mode, attempt]) => mode + '-' + attempt).join('/')} and matching visual/PWA/Android evidence cover retained reduced-tier library layout/density with economical true-3D geometry. Stand/craft/core sources and earlier evidence remain preserved; 11/29 Starter Set items are source-bound, zero accepted. Technical checks do not settle final realistic art, certified lightmaps, catalog/child/rights, device, iOS or release gates.`);
state.verificationCache.s13IncludedLibraryDensity = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(value => [value.id, value.status]), statuses);

const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} preserves the library's nominal 16-bay/8-row/8-slot\nlayout and book-placement density at lower quality tiers through economical\ncompound true-3D geometry. Current actual-App and close-up tier views bind the\nvisual review to the source. Technical success does not establish final realistic\nart quality or certified lightmaps. The stand geometry, shared craft materials\nand core composition sources remain unchanged and bound to prior evidence.\nFinal ${runs.unit.tests.passed} focused units, TypeScript and ${runs.browser.tests.passed} actual Chrome cases pass.\nEvidence: evidence/S13/library-density-20260919/result.json. PWA ${pwa.buildId.slice(0, 8)} and\nAndroid/dev ${android.buildId.slice(0, 8)} bind this source. APK SHA256: ${android.apk.sha256}.\nPrevious lighting/art/composition results and artifacts remain historical evidence.\nStarter Set remains 11/29 source-bound, zero accepted. Full scene catalog/Background\nStudio, accessory/audio/child composition, formal art/lightmaps, rights, installed-\ndevice budgets, iOS and release remain open. Stage counts stay 3 complete,\n11 in progress, 27 unstarted; first open S03. Next: refine the wood, metal and\nbook finishes identified in the inspected close-ups, preserving this density.\n<!-- s13-library-density-20260919:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(statePath, json(state));
for (const [pathname, previous] of noteFiles) await fs.writeFile(pathname, note + previous);
// D135 is proposed in README.md and is appended only by the coordinating owner.
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId,
  stageStatusesUnchanged: true, counts, firstOpen: 'S03', releaseReady: false }));
