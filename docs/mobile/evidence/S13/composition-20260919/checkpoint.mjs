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
const folder = 'docs/mobile/evidence/S13/composition-20260919';
const priorFolder = 'docs/mobile/evidence/S13/library-background-20260919';
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
assert.equal(entry.legacyKeysMutated, false);
assert.equal(entry.priorEvidence, priorFolder + '/result.json');
await verifyInputs(entry.dependencies);

// Retain accepted local evidence as historical evidence, without pretending its
// older App/source hashes describe the new transaction engine.
const prior = await read(entry.priorEvidence);
assert.equal(prior.pass, true);
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
assert.equal(sha(await fs.readFile(prior.starterSetSourceInventory.path)), prior.starterSetSourceInventory.sha256);
assert.equal(sha(await fs.readFile(prior.visualReview.path)), prior.visualReview.sha256);
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
const previousVisual = await read(prior.visualReview.path);
assert.equal(previousVisual.pass, true);
const preservedArtInputs = [];
for (const pathname of ['src/components/globeLibraryGeometry.ts', 'src/components/globeStandGeometry.ts', 'src/components/globeCraftMaterials.ts']) {
  const input = previousVisual.sourceInputs.find(value => value.path === pathname);
  assert.ok(input, pathname);
  assert.equal(sha(await fs.readFile(pathname)), input.sha256, pathname);
  preservedArtInputs.push(input);
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
const decisionCount = [...decisions.matchAll(/^- D133:/gmu)].length;
assert.ok(decisionCount <= 1, 'D133 must not be duplicated');
const marker = '<!-- s13-composition-20260919:begin -->';
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
const nextAction = 'Continue the library realism slice in next-art-design.md: source-aligned lighting, shelf/cabinet occlusion and less repetitive book/material placement. The current library remains a game-like scene, not final photorealistic art. Preserve the single renderer, current detailed library/stands and same-frame included edition/stand/background transaction. The included Starter Set remains 11/29 source-bound with zero accepted. Full accessory/audio/child composition, full catalog/Background Studio, formal art/lightmaps, rights/entitlements, installed-device budgets, iOS and release acceptance remain open. Do not repeat unchanged source-bound checks or prior artifact payload audits.';
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'INCLUDED_COMPOSITION_TRANSACTION_VALIDATED', pass: true,
  entry: await ref(folder + '/entry.json'), runs, attempts,
  priorEvidence: await ref(entry.priorEvidence), starterSetSourceInventory: inventoryReference,
  starterSetBindingsRefreshed: currentInventory !== null,
  preservedVisualReview: prior.visualReview, preservedArtInputs,
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  composition: {
    preferenceKey: 'probpera-planet-composition-v1', schemaVersion: 1,
    parts: ['editionId', 'standId', 'backgroundId'], adultIncludedOnly: true,
    sameActualFrameAcknowledgement: true, appliedAtlasSourceRepaintRollback: true,
    legacyKeysReadOnly: true, unknownReadDoesNotAuthorizeMigration: true,
    oneSerializedPreferenceRecord: true, bestEffortPortConfirmationOnly: true,
    crashDurabilityClaimed: false, fullAccessoryAudioCompositionImplemented: false,
  },
  sourceBoundStarterItems: 11, requiredStarterItems: 29, acceptedStarterItems: 0,
  existingUserRealismRequirementPreserved: true, newArtAcceptanceClaimed: false,
  decisionD133Recorded: decisionCount === 1, rightsApproval: false, childApproval: false,
  controlledNativePorts: true, actualSceneRenderedInChrome: true,
  installedNativeDevice: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', folder + '/pwa-a1/result.json', folder + '/android-a1/result.json']) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
const notes = {
  'S13.CUSTOM-001': ' Existing included edition/stand/background IDs now share one bounded composition record. Source inventory remains 11/29, zero accepted; no new catalog or art approval is implied.',
  'S13.CUSTOM-003': ' Included composition preparation requires three matching parts in one actual rendered frame; failure/cancel restore the applied scene with the retained atlas source. Legacy keys stay unchanged, unavailable new storage is distinct from absence, and one ordered preference record survives remount races. Port confirmation is not crash-safe durability or full accessory/audio composition.',
  'S13.CUSTOM-006': ' Whole included selections validate current exact edition/stand/background IDs, adult authority and quality before preparation. Unknown combinations remain denied; this does not complete the full rights/device/child/catalog compatibility graph.',
  'S13.CUSTOM-007': ' The applied atlas source remains leased across preparation and rollback; scene resources retain their existing owners. Scoped source-bound lifecycle/disposal evidence does not replace installed-device stress/soak acceptance.',
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
pushOnce(state.resume.doNotRepeat, `S13 composition-20260919 ${Object.entries(attempts).map(([mode, attempt]) => mode + '-' + attempt).join('/')} and matching PWA/Android evidence cover the bounded adult included composition transaction. Legacy art/inventory evidence remains preserved: 11/29 source-bound, zero accepted. Full catalog/accessory/audio/child composition, art/lightmaps, rights, device, iOS and release remain open.`);
state.verificationCache.s13IncludedComposition = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(value => [value.id, value.status]), statuses);

const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} binds the included edition, stand and background to\none versioned preference record. Three matching parts must share an actual frame\nbefore commit; cancellation/failure repaints the applied atlas source and restores\nthe applied scene. Legacy settings stay read-only, and unknown storage never\nauthorizes migration. A timed-out write remains ordered. Preference confirmation\nis best-effort, not a crash-durability guarantee.\nFinal ${runs.unit.tests.passed} focused units, TypeScript and ${runs.browser.tests.passed} actual Chrome cases pass.\nEvidence: evidence/S13/composition-20260919/result.json. PWA ${pwa.buildId.slice(0, 8)} and\nAndroid/dev ${android.buildId.slice(0, 8)} bind this source. APK SHA256: ${android.apk.sha256}.\nThe detailed library/stand art and its previous evidence remain preserved. This\nengine slice grants no new art/lightmap approval or full accessory/audio/child\ncomposition acceptance. Starter Set remains 11/29 source-bound, zero accepted.\nFull catalog/Background Studio, rights/entitlements, installed-device budgets,\niOS and release gates remain open. Stage counts stay 3 complete, 11 in progress,\n27 unstarted; first open S03. Next: library lighting, shelf occlusion and material/placement realism from next-art-design.md.\n<!-- s13-composition-20260919:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(statePath, json(state));
for (const [pathname, previous] of noteFiles) await fs.writeFile(pathname, note + previous);
// D133 is proposed in README.md and is appended only by the coordinating owner.
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId,
  stageStatusesUnchanged: true, counts, firstOpen: 'S03', releaseReady: false }));
