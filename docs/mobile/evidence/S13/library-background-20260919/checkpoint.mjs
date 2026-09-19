import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/library-background-20260919';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const ref = async filename => ({ path: filename, sha256: sha(await fs.readFile(filename)) });
const verifyInputs = async inputs => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  for (const input of inputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
};
const attempts = Object.freeze({ unit: 'a5', static: 'a5', browser: 'a4' });
const runs = {};
for (const [name, attempt] of Object.entries(attempts)) {
  const filename = `${folder}/${name}-${attempt}/result.json`;
  const record = await read(filename);
  assert.ok(record.pass && record.sourceInputsUnchanged, filename);
  assert.ok(record.executions.length > 0 && record.executions.every(execution => execution.exitCode === 0), filename);
  await verifyInputs(record.sourceInputs);
  if (name === 'unit') assert.deepEqual([record.tests.passed, record.tests.failed, record.tests.skipped], [217, 0, 0]);
  if (name === 'browser') {
    assert.deepEqual([record.tests.passed, record.tests.failed, record.tests.skipped, record.tests.flaky], [2, 0, 0, 0]);
    assert.deepEqual(record.tests.errors, []);
  }
  runs[name] = { ...await ref(filename), tests: record.tests };
}

const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S13');
assert.deepEqual(entry.sceneIdentity, { itemId: 'background.base.library', sceneId: 'probpera-library-3d', optionalGrandLibrary: false });
await verifyInputs(entry.dependencies);
const inventoryPath = folder + '/starter-set-source-inventory-a2.json';
const inventory = await read(inventoryPath);
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount], [29, 11, 0]);
await verifyInputs(inventory.sourceInputs);
const visual = await read(folder + '/visual-review.json');
assert.equal(visual.pass, true);
await verifyInputs(visual.sourceInputs);

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

// Validate all checkpoint inputs before changing any persistent state or notes.
const filename = 'docs/mobile/AUTOPILOT_STATE.json';
const state = await read(filename);
const statuses = state.stages.map(stage => [stage.id, stage.status]);
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status =>
  [status, state.stages.filter(stage => stage.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 });
assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(stage => stage.status !== 'COMPLETE').id, 'S03');
const stage = state.stages.find(stage => stage.id === 'S13');
assert.equal(stage.status, 'IN_PROGRESS');
const criterionIds = ['S13.CUSTOM-001', 'S13.CUSTOM-003', 'S13.CUSTOM-006', 'S13.CUSTOM-007'];
for (const id of criterionIds) {
  const criterion = stage.criteria.find(value => value.id === id);
  assert.ok(criterion, id);
  assert.ok(['OPEN', 'IN_PROGRESS'].includes(criterion.status), id);
}
const decisions = await fs.readFile('docs/mobile/DECISIONS.md', 'utf8');
assert.equal([...decisions.matchAll(/^- D132:/gmu)].length, 1, 'Existing D132 must not be duplicated');
const marker = '<!-- s13-library-background-20260919:begin -->';
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
const nextAction = 'Continue the bounded S13 full-composition design: one versioned edition/stand/background record, exact combined rendered-frame acknowledgement, migration and rollback ownership. Preserve the user-required realism of the detailed library and three included stands, canonical starfield/default frame and one scene. Starter Set is 11/29 source-bound, zero accepted. Formal art/lightmap review, full catalog/Background Studio, optional/child authority, installed-device budgets and release acceptance remain open. Do not repeat unchanged validated checks or artifact payload audits.';
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'INCLUDED_LIBRARY_AND_STAND_CRAFT_INSPECTED', pass: true,
  entry: await ref(folder + '/entry.json'), runs,
  starterSetSourceInventory: await ref(inventoryPath), visualReview: await ref(folder + '/visual-review.json'),
  nextCompositionDesign: await ref(folder + '/next-composition-design.md'),
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  sceneIdentity: entry.sceneIdentity,
  includedStandIds: ['stand.base.museum', 'stand.base.wood', 'stand.base.book-stack'],
  canonicalStarfieldRemainsDefault: true, canonicalFrameRemainsDefault: true,
  scopedCraftEvidence: {
    userRealismRequirementPreserved: true,
    source: 'src/components/globeCraftMaterials.ts', sourceProvenance: 'authored-in-project',
    qualityTiers: ['high', 'balanced', 'economy'], libraryOwnedTexturesPerTier: 17,
    libraryCameraClearanceRadius: 5.6, actualGeometryAndMaterialsImproved: true,
    formalArtAcceptance: false, certifiedLightmapAcceptance: false,
  },
  sourceBoundStarterItems: 11, requiredStarterItems: 29, acceptedStarterItems: 0,
  rightsApproval: false, childApproval: false, controlledNativePorts: true,
  actualSceneRenderedInChrome: true, installedNativeDevice: false, iosCompiled: false,
  fullCompositionTransactionImplemented: false, grantsEntitlement: false, productionActionsPerformed: false,
  stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', folder + '/visual-review.json', folder + '/pwa-a1/result.json', folder + '/android-a1/result.json']) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
for (const criterion of stage.criteria.filter(value => criterionIds.includes(value.id))) {
  criterion.status = 'IN_PROGRESS';
  pushOnce(criterion.evidence, folder + '/result.json');
  criterion.commit = sourceCommit;
  criterion.lastValidatedAt = recordedAt;
  criterion.notes += criterion.id === 'S13.CUSTOM-006'
    ? ' Exact local compatibility now validates canonical editions, included stands, quality tiers and the adult application path; unknown or child requests fail closed. This is not the full catalog/rights/device compatibility graph.'
    : ' The included two-level library and three stands now have detailed original geometry, owned procedural craft maps and inspected actual-App/close-up views following the explicit realism requirement. Same-scene preview, actual frame acknowledgement, persistence, context recovery and scoped disposal are evidenced. Formal art/lightmap acceptance, full composition, catalog, child/rights and device gates remain open.';
}
pushOnce(state.stages.find(value => value.id === 'S12').artifacts, inventoryPath);
state.updatedAt = recordedAt;
state.headSha = sourceCommit;
state.resume.nextAction = nextAction;
pushOnce(state.resume.contextFiles, folder + '/result.json');
pushOnce(state.resume.doNotRepeat, 'S13 library-background-20260919 final unit-a5/static-a5/browser-a4 and source-bound visual/PWA/Android evidence cover the included adult library, detailed stand geometry/materials and existing scene ownership. Initial prototype attempts are historical. Eleven of 29 Starter Set items are source-bound; none is fully accepted. This does not close formal art/lightmap, full composition, child/rights, device or release gates.');
state.verificationCache.s13IncludedLibraryCraft = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(value => [value.id, value.status]), statuses);

const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds the included adult library to the same globe scene\nand improves the three included stands. The user's explicit realism requirement\nreplaces the earlier simple geometry bar: architectural profiles, joinery, book\nbindings/page blocks, procedural PBR surfaces, material response and contact cues\nnow have source-bound actual-App and close-up inspection evidence. Seventeen owned\nlibrary textures per tier and face clearance beyond radius 5.6 are scoped checks,\nnot formal art/lightmap approval or installed-device performance acceptance.\nFinal 217 focused units, TypeScript and two actual Chrome cases pass.\nStarter Set inventory: 11 source-bound of 29 required, zero accepted. Evidence:\nevidence/S13/library-background-20260919/result.json. PWA ${pwa.buildId.slice(0, 8)} and\nAndroid/dev ${android.buildId.slice(0, 8)} bind this source. APK SHA256: ${android.apk.sha256}.\nEarlier artifacts remain preserved. Full catalog/Background Studio, composition\natomicity, child/rights, art/lightmaps, device, iOS and release gates remain open.\nStage counts unchanged: 3 complete, 11 in progress, 27 unstarted; first open S03.\nNext: bounded full-composition persistence/preparation and rollback ownership.\n<!-- s13-library-background-20260919:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(filename, json(state));
for (const [pathname, previous] of noteFiles) await fs.writeFile(pathname, note + previous);
// D132 was already authored for this scope. This checkpoint never appends it.
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId,
  stageStatusesUnchanged: true, counts, firstOpen: 'S03', releaseReady: false }));
