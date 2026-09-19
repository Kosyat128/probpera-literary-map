import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/three-whales-20260919';
const priorFolder = 'docs/mobile/evidence/S13/surface-realism-20260919';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async pathname => JSON.parse(await fs.readFile(pathname, 'utf8'));
const ref = async pathname => ({ path: pathname, sha256: sha(await fs.readFile(pathname)) });
const amendmentPath = folder + '/check-input-amendments.json', amendment = await read(amendmentPath);
assert.deepEqual(Object.keys(amendment).sort(), ['schemaVersion','path','beforeSha256','afterSha256','affectedRun','reuseRuns','reason','recheck'].sort());
assert.equal(amendment.schemaVersion, 1);
assert.equal(amendment.path, 'tests/pwa/globe-three-whales.spec.mjs');
assert.equal(amendment.beforeSha256, '35913d85cfc4ac9abcf8ac61f53c62da10f58bab73f50e54f7be5df18a7c2c14');
assert.equal(amendment.afterSha256, '716c2fe4864ff5b5bdc9ea1120c8543353ff073246bd6ec6ae3b78da613b9e1e');
assert.equal(amendment.affectedRun, 'browser-a1');
assert.deepEqual(amendment.reuseRuns, ['unit-a1', 'static-a1']);
assert.equal(amendment.recheck, 'browser-a2');
assert.ok(typeof amendment.reason === 'string' && amendment.reason.length > 0);
assert.equal(sha(await fs.readFile(amendment.path)), amendment.afterSha256);
const tsconfig = await read('tsconfig.json');
assert.deepEqual(tsconfig.include, ['src']); assert.deepEqual(tsconfig.references, []);
assert.equal(tsconfig.extends, undefined);
assert.ok(!tsconfig.compilerOptions.allowJs && !tsconfig.compilerOptions.checkJs);
const failedBrowserPath = folder + '/browser-a1/result.json', failedBrowser = await read(failedBrowserPath);
assert.equal(failedBrowser.pass, false); assert.equal(failedBrowser.tests.failed, 1);
assert.equal(failedBrowser.sourceInputs.find(input => input.path === amendment.path)?.sha256, amendment.beforeSha256);
const appliedInputAmendments = [];
const verifyInputs = async (inputs, runId = null) => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  assert.equal(new Set(inputs.map(input => input.path)).size, inputs.length);
  for (const input of inputs) {
    const currentHash = sha(await fs.readFile(input.path));
    if (currentHash !== input.sha256 && amendment.reuseRuns.includes(runId) && input.path === amendment.path) {
      assert.equal(input.sha256, amendment.beforeSha256); assert.equal(currentHash, amendment.afterSha256);
      appliedInputAmendments.push({ runId, path: input.path, recordedSha256: input.sha256, currentSha256: currentHash });
    } else assert.equal(currentHash, input.sha256, input.path);
  }
};
const requiredInputs = [
  'src/components/globeWhaleStandGeometry.ts', 'src/components/globeAntiqueGeometry.ts',
  'src/components/globeStandGeometry.ts', 'src/components/globeCraftMaterials.ts',
  'src/planet/globeStands.ts', 'src/planet/baseEditionPolicy.ts', 'src/host/PlanetStandControls.tsx',
];
const requireWhaleInputs = inputs => {
  for (const pathname of requiredInputs) assert.ok(inputs.some(input => input.path === pathname), pathname);
};
const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const pathname = folder + '/' + mode + '-' + attempt + '/result.json', report = await read(pathname);
  assert.equal(report.pass, true); assert.equal(report.sourceInputsUnchanged, true);
  assert.ok(report.executions.length > 0 && report.executions.every(value => value.exitCode === 0));
  assert.deepEqual(report.reportErrors, []);
  await verifyInputs(report.sourceInputs, mode + '-' + attempt); requireWhaleInputs(report.sourceInputs);
  if (mode !== 'static') {
    assert.ok(Number.isSafeInteger(report.tests.passed) && report.tests.passed > 0);
    assert.deepEqual([report.tests.failed, report.tests.skipped], [0, 0]);
  }
  if (mode === 'unit') {
    assert.ok(Number.isSafeInteger(report.tests.filteredOut) && report.tests.filteredOut >= 0);
    assert.equal(report.tests.selectedAdapterCases.length, 2);
    assert.ok(report.tests.selectedAdapterCases.every(value => value.status === 'passed'));
  }
  if (mode === 'browser') { assert.equal(report.tests.flaky, 0); assert.deepEqual(report.tests.errors, []); }
  runs[mode] = { ...await ref(pathname), tests: report.tests };
}
assert.equal('browser-' + browserAttempt, amendment.recheck);
assert.deepEqual(appliedInputAmendments.map(value => value.runId), amendment.reuseRuns.filter(value => value === 'unit-' + unitAttempt || value === 'static-' + staticAttempt));
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S13'); assert.equal(entry.artAccepted, false);
assert.equal(entry.previous, priorFolder + '/result.json'); await verifyInputs(entry.dependencies);
const prior = await read(entry.previous);
assert.equal(prior.pass, true); assert.equal(prior.sourceCommit, '2029aad9cf646e7cb679110f4cef48dc627b557f');
assert.deepEqual([prior.requiredStarterItems, prior.sourceBoundStarterItems, prior.acceptedStarterItems], [29, 11, 0]);
assert.equal(sha(await fs.readFile(prior.visualReview.path)), prior.visualReview.sha256);
const priorVisual = await read(prior.visualReview.path);
const preservedCompositionInputs = prior.preservedCompositionInputs;
assert.equal(preservedCompositionInputs.length, 7); await verifyInputs(preservedCompositionInputs);
const preservedArtInputs = [];
for (const pathname of [
  'src/components/LiteraryGlobe.tsx', 'src/components/globeCraftMaterials.ts',
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
assert.equal(inventory.items.length, 29);
assert.equal(inventory.items.some(value => value.id === 'stand.base.three-whales'), false);
const canonicalItem = inventory.items.find(value => value.id === 'canonical-globe');
assert.equal(canonicalItem.requirementId, 'STARTER-019'); assert.equal(canonicalItem.iapSkuAllowed, false);
assert.ok(canonicalItem.implementation.sources.some(value => value.path === 'src/components/globeWhaleStandGeometry.ts'));

const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.artAccepted, false);
assert.equal(visual.userRealismRequirementSatisfied, false);
await verifyInputs(visual.sourceInputs); requireWhaleInputs(visual.sourceInputs);
assert.ok(Array.isArray(visual.actualAppObservations) && visual.actualAppObservations.length > 0);
const views = visual.actualAppObservations.flatMap(value => [value.high, ...(value.tiers ?? []), value.english, value.narrow, value.restored, value.reloaded].filter(Boolean));
for (const tier of ['high', 'balanced', 'economy']) assert.ok(views.some(value => value.quality === tier), tier);
const priorDensity = priorVisual.actualAppObservations.find(value => value.high)?.high.libraryDensity;
assert.equal(priorDensity.books, 984);
for (const view of views) {
  assert.equal(view.standId, 'stand.base.three-whales'); assert.equal(view.standCount, 1);
  assert.equal(view.whales.length, 3); assert.equal(view.gems.length, 6); assert.equal(view.canonicalBodyCount, 3);
  assert.deepEqual(view.libraryDensity, priorDensity);
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
  await verifyInputs(manifest.sourceInputs.files); requireWhaleInputs(manifest.sourceInputs.files);
}
assert.equal(sha(await fs.readFile(android.apk.path)), android.apk.sha256);
// Previous artifacts are historical and already fully audited. Recheck only
// recorded result/manifest/APK preservation, never relabel them as this source.
for (const reference of [prior.pwa, prior.android]) assert.equal(sha(await fs.readFile(reference.path)), reference.sha256);
const priorPwa = await read(prior.pwa.path), priorAndroid = await read(prior.android.path);
assert.equal(sha(await fs.readFile(priorPwa.artifact.path + '/artifact.json')), priorPwa.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(priorAndroid.artifact.path + '/artifact.json')), priorAndroid.artifact.sha256);
assert.equal(sha(await fs.readFile(priorAndroid.apk.path)), priorAndroid.apk.sha256);

// Preflight all state and destination conditions before the first state write.
const statePath = 'docs/mobile/AUTOPILOT_STATE.json', state = await read(statePath);
const statuses = state.stages.map(value => [value.id, value.status]);
const counts = Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status => [status,state.stages.filter(value => value.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 });
assert.equal(state.currentStageId, 'S03'); assert.equal(state.stages.find(value => value.status !== 'COMPLETE').id, 'S03');
const stage = state.stages.find(value => value.id === 'S13'); assert.equal(stage.status, 'IN_PROGRESS');
const criterionIds = ['S13.CUSTOM-001','S13.CUSTOM-003','S13.CUSTOM-006','S13.CUSTOM-007'];
for (const id of criterionIds) assert.equal(stage.criteria.find(value => value.id === id)?.status, 'IN_PROGRESS');
const decisions = await fs.readFile('docs/mobile/DECISIONS.md','utf8');
const decisionCount = [...decisions.matchAll(/^- D137:/gmu)].length; assert.ok(decisionCount <= 1);
const marker = '<!-- s13-three-whales-20260919:begin -->', noteFiles = new Map();
for (const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']) {
  const pathname = 'docs/mobile/' + name, previous = await fs.readFile(pathname,'utf8');
  assert.equal(previous.includes(marker), false, pathname); noteFiles.set(pathname,previous);
}
await assert.rejects(fs.stat(folder + '/result.json'), { code: 'ENOENT' }); assert.equal(head(),sourceCommit);
const recordedAt = new Date().toISOString();
const nextAction = "Continue from the coordinating owner's source-bound review of the golden three-whale stand and gemstone eyes. Resolve any remaining whale form/material defects while preserving the recognizable original support, canonical site default and existing composition lifecycle. Next implement the user's explicitly queued three ceramic portrait-head stands: Alexander Pushkin, Ernest Hemingway and Leo Tolstoy, informed by recognizable famous portraits and figurative ceramic mugs. These must be modeled heads, not flat portrait decals. Then continue the recorded library/wood/metal/paper realism work; the user's maximum-realism requirement remains open. Preserve the 984-book layout, seven composition owners, 29 mandatory Starter Set identities and current evidence. Source inventory remains 11/29 with zero accepted. Formal art/lightmaps, full catalog/accessory/audio/child composition, rights, installed-device budgets, iOS and release acceptance remain open. Avoid redundant unchanged checks.";
const result = {
  schemaVersion:1,recordedAt,sourceCommit,stage:'S13',status:'GOLDEN_THREE_WHALE_STAND_SCOPED_INSPECTION',pass:true,
  entry:await ref(folder+'/entry.json'),queuedUserRequest:entry.queuedUserRequest,priorSurface:await ref(entry.previous),attempts,runs,
  checkInputAmendment:{...await ref(amendmentPath),applied:appliedInputAmendments,failedBrowser:await ref(failedBrowserPath),recheck:runs.browser,reason:amendment.reason},
  starterSetSourceInventory:await ref(inventoryPath),visualReview:await ref(visualPath),
  preservedCompositionInputs,preservedArtInputs,priorVisualReview:prior.visualReview,
  pwa:await ref(folder+'/pwa-a1/result.json'),android:await ref(folder+'/android-a1/result.json'),
  pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,
  whaleStand:{id:'stand.base.three-whales',sourceItemId:'canonical-globe',requirementId:'STARTER-019',provenance:'canonical-site-derived',finish:'gold',eyes:'faceted-deep-emerald',figures:3,eyesCount:6,canonicalSiteDefaultUnchanged:true,existingCompositionLifecycle:true},
  retainedLibraryDensity:priorDensity,requiredStarterItems:29,sourceBoundStarterItems:11,acceptedStarterItems:0,
  decisionD137Recorded:decisionCount===1,userRealismRequirementSatisfied:false,artAccepted:false,certifiedLightmaps:false,
  rightsApproval:false,childApproval:false,grantsEntitlement:false,controlledNativePorts:true,
  actualSceneRenderedInChrome:true,installedNativeDevice:false,iosCompiled:false,devicePerformanceAccepted:false,
  productionActionsPerformed:false,stageAccepted:false,releaseReady:false,nextAction,
};
const pushOnce = (list,value) => { if(!list.includes(value))list.push(value); };
for(const artifact of [folder+'/entry.json',folder+'/result.json',visualPath,inventoryPath,folder+'/pwa-a1/result.json',folder+'/android-a1/result.json'])pushOnce(stage.artifacts,artifact);
stage.lastGreenCommands=Object.entries(attempts).map(([mode,attempt])=>'node '+folder+'/run-checks.mjs '+mode+' '+attempt);
stage.lastGreenCommands.push('node '+folder+'/run-pwa.mjs '+sourceCommit,'pwsh -File '+folder+'/build-android.ps1 '+sourceCommit,'node '+folder+'/preserve-android.mjs '+sourceCommit);
const criterionNotes={
  'S13.CUSTOM-001':' The explicitly requested golden three-whale stand inherits canonical-globe identity; the immutable Starter Set remains 29 items, 11 source-bound and zero accepted. Current close-up and actual-App review is scoped evidence, not final art acceptance.',
  'S13.CUSTOM-003':' The whale choice uses the existing composition prepare/frame acknowledgement/apply/cancel/persistence owners. Seven core sources are unchanged; no second renderer or separate save authority is introduced.',
  'S13.CUSTOM-006':' Exact registry/policy and composition validation cover the added adult stand, preserving child/unknown denial and the original default. The library retains all 984 actual book placements across tiers.',
  'S13.CUSTOM-007':' Focused factory/original-body/policy/composition checks and two selected adapter cases accompany actual-App and preserved PWA/Android evidence. Deliberately filtered adapter cases are not counted as passes. Installed-device/soak and realistic-art acceptance remain open.',
};
for(const criterion of stage.criteria.filter(value=>criterionIds.includes(value.id))){pushOnce(criterion.evidence,folder+'/result.json');criterion.commit=sourceCommit;criterion.lastValidatedAt=recordedAt;criterion.notes+=criterionNotes[criterion.id];}
pushOnce(state.stages.find(value=>value.id==='S12').artifacts,inventoryPath);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;
pushOnce(state.resume.contextFiles,folder+'/result.json');
pushOnce(state.resume.doNotRepeat,'S13 golden three-whales evidence binds the exact final source, selected focused tests, actual-App/close-up inspection and preserved PWA/Android artifacts. Filtered adapter tests are not passes. Original site default, seven composition owners and 984-book library are preserved; final realism/art/device acceptance remains open.');
state.verificationCache.s13GoldenThreeWhales={path:folder+'/result.json',sha256:sha(json(result)),sourceCommit,status:result.status,stageAccepted:false,releaseReady:false};
assert.deepEqual(state.stages.map(value=>[value.id,value.status]),statuses);
const note=marker+'\nSource '+sourceCommit.slice(0,8)+' adds the user\'s original three-whale stand as an adult choice,\nwith modeled detail, gold finish and six faceted emerald eyes. The canonical site\ndefault, composition core and 984-book library remain preserved. Scoped actual-App\nand close-up inspection does not satisfy the user\'s final realism requirement.\nFinal '+runs.unit.tests.passed+' selected focused tests, TypeScript and '+runs.browser.tests.passed+' actual Chrome cases pass;\n'+runs.unit.tests.filteredOut+' unmatched adapter cases were intentionally excluded, not passed.\nPWA '+pwa.buildId.slice(0,8)+' and Android/dev '+android.buildId.slice(0,8)+' bind this exact source.\nAPK SHA256: '+android.apk.sha256+'.\nEvidence: evidence/S13/three-whales-20260919/result.json.\nStarter Set remains 11/29 source-bound, zero accepted. Stages remain 3 complete,\n11 in progress and 27 unstarted; first open S03. Next: the explicitly requested ceramic portrait-head stands of\nPushkin, Hemingway and Tolstoy, then remaining library/wood/metal/paper refinements. Formal art/lightmaps, rights, child,\nfull catalog/composition, installed devices, iOS and release remain open.\n<!-- s13-three-whales-20260919:end -->\n\n';
await fs.writeFile(folder+'/result.json',json(result),{flag:'wx'});
await fs.writeFile(statePath,json(state));
for(const[pathname,previous]of noteFiles)await fs.writeFile(pathname,note+previous);
// Only the coordinating owner appends D137; preparing this helper changes no state.
console.log(json({pass:true,sourceCommit,runs,pwa:pwa.buildId,android:android.buildId,counts,firstOpen:'S03',stageStatusesUnchanged:true,releaseReady:false}));
