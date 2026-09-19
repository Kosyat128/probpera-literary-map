import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Prepared helper only: nothing is accepted or written until the coordinating
// owner explicitly runs it with final committed source and passed evidence.
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/ceramic-portraits-20260920';
const priorFolder = 'docs/mobile/evidence/S13/three-whales-20260919';
const kinds = ['pushkin', 'hemingway', 'tolstoy'];
const ids = kinds.map(kind => 'stand.base.portrait-' + kind);
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async pathname => JSON.parse(await fs.readFile(pathname, 'utf8'));
const ref = async pathname => ({ path: pathname, sha256: sha(await fs.readFile(pathname)) });
const verifyInputs = async inputs => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  assert.equal(new Set(inputs.map(input => input.path)).size, inputs.length);
  for (const input of inputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
};
const verifyRef = async reference => {
  assert.equal(sha(await fs.readFile(reference.path)), reference.sha256, reference.path);
  return read(reference.path);
};
const requiredInputs = [
  'src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/globeStandGeometry.ts',
  'src/components/globeQuality.ts', 'src/components/globeCraftMaterials.ts',
  'src/planet/globeStands.ts', 'src/planet/baseEditionPolicy.ts', 'src/host/PlanetStandControls.tsx',
];
const requirePortraitInputs = inputs => {
  for (const pathname of requiredInputs) assert.ok(inputs.some(input => input.path === pathname), pathname);
};
const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const pathname = folder + '/' + mode + '-' + attempt + '/result.json', report = await read(pathname);
  assert.equal(report.mode, mode); assert.equal(report.pass, true); assert.equal(report.sourceInputsUnchanged, true);
  assert.ok(report.executions.length > 0 && report.executions.every(value => value.exitCode === 0));
  assert.deepEqual(report.reportErrors, []); assert.deepEqual(report.ownerAdditions, ids);
  await verifyInputs(report.sourceInputs); requirePortraitInputs(report.sourceInputs);
  if (mode !== 'static') assert.deepEqual([report.tests.failed, report.tests.skipped], [0, 0]);
  if (mode === 'unit') {
    assert.equal(report.tests.passed, 6);
    assert.deepEqual(report.tests.selection.unitFiles, [
      'src/components/globeCeramicPortraitStandGeometry.test.ts', 'src/planet/globeCeramicPortraitStandPolicy.test.ts',
    ]);
    assert.equal(report.tests.selection.expectedUnitCases, 4);
    assert.ok(Number.isSafeInteger(report.tests.filteredOut) && report.tests.filteredOut >= 0);
    assert.equal(report.tests.selectedAdapterCases.length, 2);
    assert.ok(report.tests.selectedAdapterCases.every(value => value.status === 'passed'));
  }
  if (mode === 'browser') {
    assert.equal(report.tests.passed, 1); assert.equal(report.tests.flaky, 0); assert.deepEqual(report.tests.errors, []);
  }
  runs[mode] = { ...await ref(pathname), tests: report.tests };
}
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S13'); assert.equal(entry.artAccepted, false); assert.equal(entry.likenessAccepted, false);
assert.deepEqual(entry.additionalIds, ids);
assert.equal(entry.previous, priorFolder + '/result.json'); await verifyInputs(entry.dependencies);
const prior = await read(entry.previous);
assert.equal(prior.pass, true); assert.equal(prior.sourceCommit, '5a43171abb8cd77ff207816e6dbac0962e78f92e');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
const priorVisual = await verifyRef(prior.visualReview);
const preservedCompositionInputs = prior.preservedCompositionInputs;
assert.equal(preservedCompositionInputs.length, 7); await verifyInputs(preservedCompositionInputs);
const preservedArtInputs = [];
for (const pathname of [
  'src/components/LiteraryGlobe.tsx', 'src/components/globeWhaleStandGeometry.ts',
  'src/components/globeAntiqueGeometry.ts', 'src/components/globeCraftMaterials.ts',
  'src/components/globeTurnedWoodAtlas.ts', 'src/components/globeLibraryGeometry.ts',
  'src/components/globeLibraryBookGeometry.ts',
]) {
  const input = priorVisual.sourceInputs.find(value => value.path === pathname); assert.ok(input, pathname);
  await verifyInputs([input]); preservedArtInputs.push(input);
}
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath);
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount], [29, 11, 0]);
await verifyInputs(inventory.sourceInputs);
const priorInventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.items.length, 29);
assert.deepEqual(inventory.items.map(item => item.id), priorInventory.items.map(item => item.id));
assert.equal(inventory.items.some(item => ids.includes(item.id)), false);
assert.equal(inventory.ownerAddedCount, 3);
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), [...ids].sort());
for (const item of inventory.ownerAdditions) {
  assert.equal(item.sourceItemId, item.id); assert.equal(item.canonicalSource, null);
  assert.equal(Object.hasOwn(item, 'requirementId'), false); assert.equal(item.required, false);
  assert.equal(item.inclusionBasis, 'explicit-owner-request'); assert.equal(item.commercialAvailability, 'included-in-base');
  assert.equal(item.provenance, 'authored-in-project'); assert.equal(item.supportedAccess, 'adult');
  for (const flag of ['iapSkuAllowed','childReviewed','rightsReviewed','artReviewed','grantsEntitlement','releaseReady']) assert.equal(item[flag], false);
  assert.equal(item.acceptance, 'OPEN'); assert.equal(item.implementation.status, 'source-present');
  assert.ok(item.implementation.sources.some(value => value.path === 'src/components/globeCeramicPortraitStandGeometry.ts'));
  await verifyInputs(item.implementation.sources);
}

const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.artAccepted, false); assert.equal(visual.likenessAccepted, false);
assert.equal(visual.userRealismRequirementSatisfied, false);
await verifyInputs(visual.sourceInputs); requirePortraitInputs(visual.sourceInputs);
const actualApp = await verifyRef(visual.actualAppCapture);
assert.equal(actualApp.pass, true); assert.equal(actualApp.actualApp, true);
assert.deepEqual(actualApp.errors, []); assert.deepEqual(actualApp.missingResources, []);
assert.deepEqual(visual.actualAppObservations, actualApp.observations);
assert.ok(Array.isArray(visual.actualAppObservations) && visual.actualAppObservations.length > 0);
const priorDensity = prior.retainedLibraryDensity; assert.equal(priorDensity.books, 984);
for (const observation of visual.actualAppObservations) {
  assert.equal(observation.high.length, 3); assert.equal(observation.economy.length, 3);
  for (const [tier, views] of [['high', observation.high], ['economy', observation.economy]]) {
    assert.deepEqual(views.map(view => view.standId).sort(), [...ids].sort());
    assert.ok(views.every(view => view.quality === tier));
  }
  assert.equal(observation.balanced.quality, 'balanced');
  for (const view of [...observation.high, observation.balanced, ...observation.economy, observation.narrow, observation.reloaded]) {
    assert.ok(view && ids.includes(view.standId)); assert.equal(view.standCount, 1); assert.equal(view.surfaceCount, 1);
    assert.equal(view.portraits.length, 1);
    const portrait = view.portraits[0];
    assert.equal('stand.base.portrait-' + portrait.kind, view.standId); assert.equal(portrait.head, true);
    assert.ok(Number.isSafeInteger(portrait.surfaceColors) && portrait.surfaceColors >= 2);
    assert.deepEqual(view.libraryDensity, priorDensity);
  }
}
const art = await verifyRef(visual.artCapture);
assert.equal(art.sourceInputsUnchanged, true); assert.deepEqual(art.errors, []); await verifyInputs(art.sourceInputs);
assert.ok(art.sourceInputs.some(input => input.path === 'src/components/globeCeramicPortraitStandGeometry.ts'));
assert.ok(Array.isArray(art.frames) && art.frames.length > 0);
for (const kind of kinds) assert.ok(art.frames.some(frame => frame.kind === kind), kind);
assert.ok(art.frames.every(frame => frame.transformedBounds.finite && frame.normals.finite));
assert.ok(art.disposal.retired.length > 0 && art.disposal.retired.every(owner => owner.exactOnce));
assert.ok(Array.isArray(visual.images) && visual.images.length > 0);
assert.ok(visual.images.some(image => image.actualApp) && visual.images.some(image => !image.actualApp));
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.equal(sha(await fs.readFile(image.path)), image.sha256, image.path);
}
const pwa = await read(folder + '/pwa-a1/result.json'), android = await read(folder + '/android-a1/result.json');
for (const record of [pwa, android]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
for (const [record, expectedHash] of [[pwa, pwa.artifact.artifactSha256], [android, android.artifact.sha256]]) {
  const bytes = await fs.readFile(record.artifact.path + '/artifact.json'); assert.equal(sha(bytes), expectedHash);
  const manifest = JSON.parse(bytes); assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files); requirePortraitInputs(manifest.sourceInputs.files);
}
assert.equal(sha(await fs.readFile(android.apk.path)), android.apk.sha256);
// Historical payloads were already audited: preserve result/manifest/APK
// identities without rerunning their suites or rehashing every old payload.
const priorPwa = await verifyRef(prior.pwa), priorAndroid = await verifyRef(prior.android);
assert.equal(sha(await fs.readFile(priorPwa.artifact.path + '/artifact.json')), priorPwa.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(priorAndroid.artifact.path + '/artifact.json')), priorAndroid.artifact.sha256);
assert.equal(sha(await fs.readFile(priorAndroid.apk.path)), priorAndroid.apk.sha256);

// Every source/report/artifact/state preflight precedes the first state write.
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(statePath);
const statuses = state.stages.map(value => [value.id, value.status]);
const counts = Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status => [status,state.stages.filter(value => value.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 });
assert.equal(state.currentStageId, 'S03'); assert.equal(state.stages.find(value => value.status !== 'COMPLETE').id, 'S03');
const stage = state.stages.find(value => value.id === 'S13'); assert.equal(stage.status, 'IN_PROGRESS');
const criterionIds = ['S13.CUSTOM-001','S13.CUSTOM-003','S13.CUSTOM-006','S13.CUSTOM-007'];
for (const id of criterionIds) assert.equal(stage.criteria.find(value => value.id === id)?.status, 'IN_PROGRESS');
const decisions = await fs.readFile('docs/mobile/DECISIONS.md','utf8');
const decisionCount = [...decisions.matchAll(/^- D138:/gmu)].length; assert.ok(decisionCount <= 1);
const marker = '<!-- s13-ceramic-portraits-20260920:begin -->', noteFiles = new Map();
for (const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {
  const pathname = 'docs/mobile/' + name, previous = await fs.readFile(pathname,'utf8');
  assert.equal(previous.includes(marker), false, pathname); noteFiles.set(pathname,previous);
}
await assert.rejects(fs.stat(folder + '/result.json'), { code: 'ENOENT' }); assert.equal(head(),sourceCommit);
const recordedAt = new Date().toISOString();
const nextAction = "Continue from the coordinating owner's source-bound review of the original ceramic portrait stands for Pushkin, Hemingway and Tolstoy. Refine recognizability, facial anatomy, hair/beard continuity and believable ceramic response where the reviewed images show unresolved defects; do not equate distinct meshes or passing checks with accepted portrait likeness. Preserve the golden whales, canonical site default, single scene, seven composition owners and 984-book library. Continue remaining library/wood/metal/paper realism work and the existing full application plan through the routed requirements. The three explicit owner additions remain separate from the 29 mandatory Starter Set items: 11 source-bound, zero accepted. Formal art/likeness/lightmaps, full catalog/accessory/audio/child composition, rights, installed-device budgets, iOS and release acceptance remain open. Avoid redundant unchanged checks.";
const result = {
  schemaVersion:1,recordedAt,sourceCommit,stage:'S13',status:'CERAMIC_PORTRAIT_STANDS_SCOPED_INSPECTION',pass:true,
  entry:await ref(folder+'/entry.json'),userRequest:entry.userRequest,priorWhales:await ref(entry.previous),attempts,runs,
  starterSetSourceInventory:await ref(inventoryPath),visualReview:await ref(visualPath),
  preservedCompositionInputs,preservedArtInputs,priorVisualReview:prior.visualReview,
  pwa:await ref(folder+'/pwa-a1/result.json'),android:await ref(folder+'/android-a1/result.json'),
  pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,
  ownerAdditions:inventory.ownerAdditions,ownerAddedCount:3,retainedLibraryDensity:priorDensity,
  requiredStarterItems:29,sourceBoundStarterItems:11,acceptedStarterItems:0,
  decisionD138Recorded:decisionCount===1,userRealismRequirementSatisfied:false,likenessAccepted:false,artAccepted:false,certifiedLightmaps:false,
  rightsApproval:false,childApproval:false,grantsEntitlement:false,controlledNativePorts:true,
  actualSceneRenderedInChrome:true,installedNativeDevice:false,iosCompiled:false,devicePerformanceAccepted:false,
  productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction,
};
const pushOnce = (list,value) => { if(!list.includes(value))list.push(value); };
for(const artifact of [folder+'/entry.json',folder+'/result.json',visualPath,inventoryPath,folder+'/pwa-a1/result.json',folder+'/android-a1/result.json'])pushOnce(stage.artifacts,artifact);
stage.lastGreenCommands=Object.entries(attempts).map(([mode,attempt])=>'node '+folder+'/run-checks.mjs '+mode+' '+attempt);
stage.lastGreenCommands.push('node '+folder+'/run-pwa.mjs '+sourceCommit,'pwsh -File '+folder+'/build-android.ps1 '+sourceCommit,'node '+folder+'/preserve-android.mjs '+sourceCommit);
const criterionNotes={
  'S13.CUSTOM-001':' Three explicit owner-added ceramic portrait stands are self-canonical included items, separate from 29 mandatory requirements. Starter Set remains 11 source-bound and zero accepted; likeness and art acceptance remain open.',
  'S13.CUSTOM-003':' Portrait choices use the existing whole-composition prepare/frame/apply/cancel/persistence lifecycle. Seven core sources, one scene and the previous golden whale geometry are preserved.',
  'S13.CUSTOM-006':' Exact adult IDs, owner-inclusion policy and composition validation preserve unknown/child denial. Source-bound actual-App observations retain all 984 library placements and show each modeled portrait at High and Economy.',
  'S13.CUSTOM-007':' Four new ceramic unit cases, two filtered adapter cases, TypeScript and one actual Chrome case accompany inspected images and preserved PWA/Android artifacts. Excluded tests are not passes; artistic likeness and device acceptance remain open.',
};
for(const criterion of stage.criteria.filter(value=>criterionIds.includes(value.id))){pushOnce(criterion.evidence,folder+'/result.json');criterion.commit=sourceCommit;criterion.lastValidatedAt=recordedAt;criterion.notes+=criterionNotes[criterion.id];}
pushOnce(state.stages.find(value=>value.id==='S12').artifacts,inventoryPath);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
pushOnce(state.resume.contextFiles,folder+'/result.json');
pushOnce(state.resume.doNotRepeat,'S13 ceramic portrait evidence binds exact source, six selected unit/adapter cases, TypeScript, one actual Chrome case and inspected captures with preserved PWA/Android artifacts. Three owner additions do not alter the 29 mandatory Starter Set identities. Golden whales, seven composition owners and 984-book layout remain preserved; likeness, realism, art and device acceptance remain open.');
state.verificationCache.s13CeramicPortraits={path:folder+'/result.json',sha256:sha(json(result)),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(value=>[value.id,value.status]),statuses);
const note=marker+'\nSource '+sourceCommit.slice(0,8)+' adds three original ceramic portrait-head stands of Pushkin, Hemingway\nand Tolstoy through the existing adult composition lifecycle. They are explicit\nowner additions, separate from the immutable 29 mandatory Starter Set identities.\nSource-bound image inspection and technical checks do not establish accepted\nlikeness, art or the user\'s maximum-realism requirement. The golden whales,\ncanonical site default, seven composition owners and 984-book library are preserved.\nFinal '+runs.unit.tests.passed+' selected unit/adapter cases, TypeScript and '+runs.browser.tests.passed+' actual Chrome case pass;\n'+runs.unit.tests.filteredOut+' unmatched adapter cases were excluded, not passed.\nPWA '+pwa.buildId.slice(0,8)+' and Android/dev '+android.buildId.slice(0,8)+' bind this exact source.\nAPK SHA256: '+android.apk.sha256+'.\nEvidence: evidence/S13/ceramic-portraits-20260920/result.json.\nStarter Set remains 11/29 source-bound, zero accepted, plus three owner additions.\nStages remain 3 complete, 11 in progress and 27 unstarted; first open S03.\nNext: improve the remaining portrait/material realism from reviewed images, then\ncontinue the existing full application plan. Art/likeness/lightmaps, rights, child,\nfull catalog/composition, installed devices, iOS and release remain open.\n<!-- s13-ceramic-portraits-20260920:end -->\n\n';
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
await fs.writeFile(statePath,json(state));
for(const[pathname,previous]of noteFiles)await fs.writeFile(pathname,note+previous);
// Only the coordinating owner appends D138; preparing this helper changes no state.
console.log(json({pass:true,sourceCommit,runs,pwa:pwa.buildId,android:android.buildId,counts,firstOpen:'S03',stageStatusesUnchanged:true,releaseReady:false}));
