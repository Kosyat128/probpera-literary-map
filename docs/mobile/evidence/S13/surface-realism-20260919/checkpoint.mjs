import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Explicit attempts bind the checkpoint to the coordinator's final green runs.
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9]\d*$/u);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/surface-realism-20260919';
const priorFolder = 'docs/mobile/evidence/S13/library-density-20260919';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const ref = async filename => ({ path: filename, sha256: sha(await fs.readFile(filename)) });
const verifyInputs = async inputs => {
  assert.ok(Array.isArray(inputs) && inputs.length > 0);
  for (const input of inputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
};
const surfaceInputs = [
  'src/components/globeCraftMaterials.ts', 'src/components/globeStandGeometry.ts',
  'src/components/globeTurnedWoodAtlas.ts', 'src/components/globeLibraryGeometry.ts',
  'src/components/globeLibraryBookGeometry.ts',
];
const requireSurfaceInputs = inputs => {
  for (const pathname of surfaceInputs) assert.ok(inputs.some(input => input.path === pathname), pathname);
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
  requireSurfaceInputs(record.sourceInputs);
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
assert.equal(entry.previousDensity, priorFolder + '/result.json');
await verifyInputs(entry.dependencies);

// Prior art is historical. Only the composition core and economical book-shell
// helper are asserted unchanged; craft/stand/library surfaces intentionally move.
const prior = await read(entry.previousDensity);
assert.equal(prior.pass, true);
assert.equal(prior.sourceCommit, 'f0a275abfbdec4e2afaa36fe3ab8ce061d86f7e4');
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
const bookHelperPath = 'src/components/globeLibraryBookGeometry.ts';
const preservedBookGeometryInput = previousVisual.sourceInputs.find(value => value.path === bookHelperPath);
assert.ok(preservedBookGeometryInput, bookHelperPath);
assert.equal(sha(await fs.readFile(bookHelperPath)), preservedBookGeometryInput.sha256, bookHelperPath);

// Material bindings changed, so this slice requires a fresh inventory.
const inventoryPath = folder + '/starter-set-source-inventory.json';
const inventory = await read(inventoryPath);
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount], [29, 11, 0]);
await verifyInputs(inventory.sourceInputs);
const inventoryReference = await ref(inventoryPath);
const visualPath = folder + '/visual-review.json';
const visual = await read(visualPath);
assert.equal(visual.pass, true);
assert.equal(visual.artAccepted, false);
await verifyInputs(visual.sourceInputs);
requireSurfaceInputs(visual.sourceInputs);

// Inspect the same actual instance placements, not nominal slot counts. The
// current material colours may differ from historical art, but not across tiers.
const nominalLayout = { bays: 16, rowsPerBay: 8, slotsPerRow: 8 };
assert.deepEqual(prior.libraryDensity.nominalLayout, nominalLayout);
assert.equal(prior.libraryDensity.lowerTiersRetainPlacementDensity, true);
const previousHigh = previousVisual.actualAppObservations.find(value => value.high?.quality === 'high')?.high;
assert.equal(previousHigh?.libraryDensity?.books, 984);
assert.ok(Number.isSafeInteger(previousHigh.libraryDensity.placements));
assert.ok(Array.isArray(visual.actualAppObservations) && visual.actualAppObservations.length > 0);
const views = visual.actualAppObservations.flatMap(value => [value.high, ...(value.tiers ?? []), value.english, value.narrow, value.restored].filter(Boolean));
const currentHigh = views.find(value => value.quality === 'high');
assert.ok(currentHigh);
assert.ok(Number.isSafeInteger(currentHigh.libraryDensity?.colors));
for (const tier of ['high', 'balanced', 'economy']) assert.ok(views.some(value => value.quality === tier), tier);
for (const view of views) {
  assert.equal(view.libraryDensity?.books, previousHigh.libraryDensity.books);
  assert.equal(view.libraryDensity?.placements, previousHigh.libraryDensity.placements);
  assert.equal(view.libraryDensity?.colors, currentHigh.libraryDensity.colors);
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
  requireSurfaceInputs(manifest.sourceInputs.files);
}
assert.equal(sha(await fs.readFile(android.apk.path)), android.apk.sha256);

// Complete every evidence/state preflight before writing results or notes.
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
const decisionCount = [...decisions.matchAll(/^- D136:/gmu)].length;
assert.ok(decisionCount <= 1, 'D136 must not be duplicated');
const marker = '<!-- s13-surface-realism-20260919:begin -->';
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
const nextAction = "Implement the user's explicitly requested original three-whale stand next, preserving its recognizable site-derived forms while improving the finish to gold with faceted deep-emerald gemstone eyes. Expose it through the existing adult application composition and actual-frame lifecycle; retain the canonical website default and 29-item Starter Set. Then address the current owner's reviewed wood identity, coarse library grain, evenly warm metal/purple highlights and uniform paper defects. Preserve the 984 actual book placements across tiers, economical true-3D book geometry and validated composition core. Current scoped inspection and technical passes do not satisfy the user's final realism requirement or establish certified lightmaps/device acceptance. Starter Set remains 11/29 source-bound with zero accepted; full catalog, accessory/audio/child composition, rights, installed-device budgets, iOS and release gates remain open. Do not repeat unchanged checks or old artifact payload audits.";
const result = {
  schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'INCLUDED_LIBRARY_AND_STAND_SURFACES_INSPECTED', pass: true,
  entry: await ref(folder + '/entry.json'), runs, attempts,
  priorDensity: await ref(entry.previousDensity), priorComposition: prior.priorComposition,
  starterSetSourceInventory: inventoryReference, starterSetBindingsRefreshed: true,
  previousArtReview: prior.visualReview, preservedCompositionInputs, preservedBookGeometryInput,
  visualReview: await ref(visualPath),
  pwa: await ref(folder + '/pwa-a1/result.json'), android: await ref(folder + '/android-a1/result.json'),
  pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  surfaceRealism: {
    scope: 'included-library-and-stand-material-surfaces', provenance: 'authored-in-project',
    sharedCraftMaterialsChanged: true, standWoodMappingChanged: true, libraryLocalMaterialsChanged: true,
    coreCompositionUnchanged: true, economicalBookGeometryUnchanged: true,
    commonGlobeLightingOwnershipPreserved: true, actualAppAndCloseupReviewRequired: true,
    certifiedLightmapApproval: false,
  },
  retainedLibraryDensity: {
    nominalLayout, actualBooksPerTier: currentHigh.libraryDensity.books,
    placementFingerprint: currentHigh.libraryDensity.placements,
    currentColourFingerprint: currentHigh.libraryDensity.colors,
    tiers: ['high', 'balanced', 'economy'], matchesPreviousPlacements: true,
  },
  sourceBoundStarterItems: 11, requiredStarterItems: 29, acceptedStarterItems: 0,
  existingUserRealismRequirementPreserved: true, artAccepted: false,
  decisionD136Recorded: decisionCount === 1, rightsApproval: false, childApproval: false,
  controlledNativePorts: true, actualSceneRenderedInChrome: true,
  installedNativeDevice: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction,
};
const pushOnce = (list, value) => { if (!list.includes(value)) list.push(value); };
for (const artifact of [folder + '/entry.json', folder + '/result.json', visualPath, inventoryPath, folder + '/pwa-a1/result.json', folder + '/android-a1/result.json']) pushOnce(stage.artifacts, artifact);
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/run-checks.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
const notes = {
  'S13.CUSTOM-001': ' Included library and stand surfaces refine wood mapping, oxidation and leather response while retaining the reviewed library density. Current source-bound actual-App and close-up review remains scoped evidence, not final art acceptance. No catalog IDs added; inventory remains 11/29 source-bound, zero accepted.',
  'S13.CUSTOM-003': ' Material and wood-mapping changes remain within the existing composition owners and one scene. Seven core files and the economical book-shell helper match prior evidence. Full accessory/audio/child composition and crash-safe persistence remain open.',
  'S13.CUSTOM-006': ' Current tier views preserve the 984 actual book placements and existing composition compatibility. Material refinement does not widen child, optional, rights or installed-device authority.',
  'S13.CUSTOM-007': ' Current material/geometry ownership checks, source-bound tier views and preserved builds accompany the surface changes. Density and economical book-shell geometry remain bound to prior evidence; technical success does not establish realistic art, installed-device performance or soak acceptance.',
};
for (const criterion of stage.criteria.filter(value => criterionIds.includes(value.id))) {
  pushOnce(criterion.evidence, folder + '/result.json');
  criterion.commit = sourceCommit;
  criterion.lastValidatedAt = recordedAt;
  criterion.notes += notes[criterion.id];
}
pushOnce(state.stages.find(value => value.id === 'S12').artifacts, inventoryPath);
state.updatedAt = recordedAt;
state.headSha = sourceCommit;
state.resume.nextAction = nextAction;
pushOnce(state.resume.contextFiles, folder + '/result.json');
pushOnce(state.resume.doNotRepeat, `S13 surface-realism-20260919 ${Object.entries(attempts).map(([mode, attempt]) => mode + '-' + attempt).join('/')} and matching visual/PWA/Android evidence cover the inspected library/stand surface changes. Composition core and economical book helper remain unchanged; 984 actual book placements are retained across tiers. Starter Set remains 11/29 source-bound, zero accepted. Follow current reviewed visible defects; technical checks do not satisfy final realistic art, lightmaps, catalog/child/rights, device, iOS or release gates.`);
state.verificationCache.s13IncludedSurfaceRealism = { path: folder + '/result.json', sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(state.stages.map(value => [value.id, value.status]), statuses);

const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} refines original wood mapping, oxidation and leather\nsurfaces in the included library and stands. The user's realistic-quality bar\nstill requires the coordinating owner's actual-App and close-up assessment;\nthis scoped review is not formal art or certified-lightmap approval.\nThe nominal 16-bay/8-row/8-slot library retains 984 actual book placements across\ntiers. The economical book helper and seven composition core files are unchanged.\nFinal ${runs.unit.tests.passed} focused units, TypeScript and ${runs.browser.tests.passed} actual Chrome cases pass.\nEvidence: evidence/S13/surface-realism-20260919/result.json. PWA ${pwa.buildId.slice(0, 8)} and\nAndroid/dev ${android.buildId.slice(0, 8)} bind this source. APK SHA256: ${android.apk.sha256}.\nPrevious density/art/composition evidence and artifacts remain preserved.\nStarter Set stays 11/29 source-bound, zero accepted. Stages stay 3 complete,\n11 in progress, 27 unstarted; first open S03. Full catalog, accessory/audio/child\ncomposition, formal art/lightmaps, rights, device, iOS and release remain open.\nNext: improve and add the user's original three-whale stand with a gold finish\nand faceted deep-emerald gemstone eyes, preserving its recognizable site forms.\nThen address the reviewed wood identity, coarse grain, metal/purple-highlight\nand uniform-paper defects. The user's final realism requirement remains open.\n<!-- s13-surface-realism-20260919:end -->\n\n`;
await fs.writeFile(folder + '/result.json', json(result), { flag: 'wx' });
await fs.writeFile(statePath, json(state));
for (const [pathname, previous] of noteFiles) await fs.writeFile(pathname, note + previous);
// D136 is proposed in README.md and appended only by the coordinating owner.
console.log(json({ pass: true, sourceCommit, runs, pwa: pwa.buildId, android: android.buildId,
  stageStatusesUnchanged: true, counts, firstOpen: 'S03', releaseReady: false }));
