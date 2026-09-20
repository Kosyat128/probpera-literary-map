import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Preparation draft: validate existing evidence only, once final reports exist.
// No test, build, inventory or capture runs occur here.
// Usage: node <this-file> <source40> [browserAttempt=a3] [unitAttempt=a3] [staticAttempt=a3]
const [sourceCommit, browserAttempt = 'a3', unitAttempt = 'a3', staticAttempt = 'a3', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [browserAttempt, unitAttempt, staticAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S15/planetka-visual-mode-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s15-planetka-visual';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/planetka-visual-mode.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const changedRuntime = ['src/App.tsx', 'src/components/BookArchiveSection.tsx', 'src/loading/DeferredHomepageArchives.tsx'];
const newRuntime = ['src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts', 'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css',
  'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css', 'src/assets/mascots/knizhulyk-green-v1.png', 'src/books/bookArchiveAuthorRequest.ts'];
const required = [...changedRuntime, ...newRuntime];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S15'); assert.equal(entry.checkpoint, 'a2ad07a5666cf433368511c78363fe4e879cdaf4');
assert.equal(entry.previous, 'docs/mobile/evidence/S13/library-window-depth-20260920/result.json');
assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 43); await verifyInputs(entry.preservedInputs);
assert.equal(entry.preservedInputs.some(item => item.path === 'src/components/globeCraftMaterials.ts'), true);
assert.equal(entry.preservedInputs.some(item => item.path === 'src/components/globeLibraryGeometry.ts'), true);
for (const file of ['src/components/GlobeCameraRig.tsx', 'src/components/globeStandInspection.ts', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx']) {
  assert.ok(entry.preservedInputs.some(item => item.path === file));
  assert.ok((await fs.readFile(file)).equals(execFileSync('git', ['show', entry.checkpoint + ':' + file], { windowsHide: true, env: process.env })), file + ': exact original scene source');
}
const supersededHarness = await verifyRef(entry.supersededHarness);
await verifyInputs([...supersededHarness.prePivotHarness, ...supersededHarness.a1BrowserHarness]);
const assetProvenance = await read(folder + '/asset-provenance.json');
await verifyInputs([entry.asset, assetProvenance.reference]);
assert.equal(assetProvenance.asset.path, entry.asset.path);
assert.equal(assetProvenance.asset.sha256, entry.asset.sha256);
assert.equal(assetProvenance.asset.bytes, entry.asset.bytes);
assert.equal(entry.asset.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
assert.deepEqual([assetProvenance.asset.width, assetProvenance.asset.height, assetProvenance.asset.pngColorType], [1254, 1254, 6]);
assert.equal(assetProvenance.live3DMesh, false); noApproval(assetProvenance, ['artAccepted', 'childReviewed', 'releaseReady']);
const compositionOwners = ['src/planet/globeComposition.ts', 'src/host/planetComposition.ts', 'src/host/planetCompositionPresentation.ts',
  'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/globeAtlas.ts', 'src/components/useGlobeStyleState.ts'];
requireInputs(entry.preservedInputs, compositionOwners);
assert.deepEqual(entry.changedInputsBefore.map(item => item.path).sort(), [...changedRuntime].sort());
for (const item of entry.changedInputsBefore) {
  assert.equal(item.sourceCommit, entry.checkpoint);
  assert.equal(sha(execFileSync('git', ['show', entry.checkpoint + ':' + item.path], { windowsHide: true, env: process.env })), item.gitBlobSha256);
}
assert.deepEqual([...entry.newSourcePaths].sort(), [...newRuntime].sort());
await verifyInputs([prior.visualReview, prior.priorVisualReview, prior.priorSceneVisualReview, prior.priorArtReview, prior.priorArtCapture]);
assert.deepEqual(entry.priorStarterSetSourceInventory, prior.starterSetSourceInventory);
assert.equal(entry.inventoryHandling, 'historical-with-explicit-changed-inputs');
const inventory = await verifyRef(prior.starterSetSourceInventory), inventoryChangedInputs = [];
assert.equal(inventory.auditValid, true);
noApproval(inventory, ['stageAccepted', 'grantsEntitlement', 'productionActionsPerformed', 'releaseReady']);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 13, 0, 3]);
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }
const currentChangedPaths = new Set(entry.changedInputsBefore.map(item => item.path));
const inheritedInventoryChanges = new Map(prior.inventoryChangedInputs.map(item => [item.path, item]));
const allowedInventoryChanges = new Set([...currentChangedPaths, ...inheritedInventoryChanges.keys()]);
for (const item of inventory.sourceInputs) {
  const current = await ref(item.path), inherited = inheritedInventoryChanges.get(item.path);
  if (inherited) {
    assert.equal(inherited.priorSha256, item.sha256);
    if (!currentChangedPaths.has(item.path)) assert.equal(current.sha256, inherited.currentSha256, 'Inherited input drift: ' + item.path);
  }
  if (current.sha256 !== item.sha256) {
    assert.ok(allowedInventoryChanges.has(item.path), 'Unexpected historical inventory drift: ' + item.path);
    inventoryChangedInputs.push({ path: item.path, priorSha256: item.sha256, currentSha256: current.sha256 });
  }
}
assert.ok(inventoryChangedInputs.length > 0);

const unitFiles = ['src/host/planetMascot.test.ts', 'src/books/bookArchiveAuthorRequest.test.ts'], units = await read(`${folder}/unit-${unitAttempt}/vitest.json`);
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
    let reason = report.reportError ?? 'Earlier attempt retained unchanged; selected final validation is recorded separately.';
    let failureReport = null;
    if (mode === 'browser' && !report.pass) {
      const file = `${folder}/browser-${attempt}/playwright.json`, failed = await read(file), messages = [];
      const failures = suite => { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? [])
        for (const result of test.results ?? []) for (const error of result.errors ?? []) if (error.message) messages.push(error.message);
        for (const child of suite.suites ?? []) failures(child); };
      for (const suite of failed.suites ?? []) failures(suite);
      if (messages.length) reason = messages.join('\n');
      failureReport = await ref(file);
    }
    earlierAttempts.push({ ...await ref(file), mode, attempt, pass: report.pass, tests: report.tests,
      supersededContract: attempt === 'a1', contractNote: attempt === 'a1' ? 'Earlier on-globe visual contract explicitly replaced by the owner; not final evidence for the independent DOM companion.' : null,
      sourceManifest: report.sourceManifest, ...(failureReport ? { failureReport } : {}), supersededSource: report.sourceManifest.sha256 !== sourceManifest.sha256, reason });
  }
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.equal(path.basename(specs[0].file.replaceAll('\\', '/')), 'planetka-visual-mode.spec.mjs');
const copies = attachments.filter(item => item.name === 'planetka-visual-mode-source-evidence' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'planetka-visual-mode.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe', 'independentDomCompanion', 'actualPngDecoded', 'wholeImageFits',
  'noGlobeCharacterMeshes', 'showHideDoesNotMoveCamera', 'stepsDoNotOwnCamera', 'sameSceneAndAtlas', 'semanticTourSurvivesLocale',
  'nextBackHighlightActualControls', 'hideCancelsTour', 'canonicalWriterAndBooksNavigation', 'canonicalAuthorFilterApplied', 'honestRouteCompletion', 'manualAuthorFilterFencesCompletion', 'appearanceUsesCanonicalControls', 'collectionKeyboardPriority', 'collectionSearchFocusRestored',
  'visibilitySuspendsWithoutPopup', 'noAppearanceOrProfileWrites']) assert.equal(app[key], true, key);
noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated', 'childAccessGranted',
  'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
assert.equal(app.artwork.sha256, entry.asset.sha256); assert.equal(app.artwork.path, entry.asset.path);
assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.artwork.bundledPath && item.sha256 === entry.asset.sha256));
for (const name of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[name], []);
await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs);
assert.ok(app.observations && !Array.isArray(app.observations));
for (const name of ['baseline', 'desktop', 'searchHint', 'narrow', 'narrowHint', 'writerSelected', 'authorFilter', 'collection', 'completion', 'appearance', 'searchReturned', 'returned', 'resumed']) {
  assert.ok(app.observations[name] && typeof app.observations[name] === 'object', name);
}
const appearanceKeys = new Set(['probpera-planet-composition-v1', 'probpera-planet-stand-v1', 'probpera-planet-background-v1', 'probpera.globe-edition.v2', 'probpera.globe-style.v1']);
assert.ok(Array.isArray(app.preferenceOperations));
assert.deepEqual(app.preferenceOperations.filter(item => item.operation !== 'get' && appearanceKeys.has(item.key)), []);
assert.deepEqual(app.customizationWrites, []);
assert.deepEqual(app.unexpectedPreferenceWrites, []);
assert.equal(app.screenshots.length, 3); assert.equal(new Set(app.screenshots.map(item => item.filename)).size, 3);
assert.deepEqual(app.screenshots.map(item => item.filename).sort(), ['mr-booky-collection-en-landscape.png', 'mr-booky-help-ru-1440.png', 'mr-booky-tour-en-320.png']);
const images = app.screenshots.map(item => {
  assert.match(item.filename, /^[A-Za-z0-9_-]+\.png$/u);
  assert.ok(typeof item.framing === 'string' && item.framing.trim());
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
  assert.ok(manifest.sourceInputs.files.some(item => item.path === entry.asset.path && item.sha256 === entry.asset.sha256));
  const bundledImage = manifest.inventory.filter(item => item.sha256 === entry.asset.sha256 && item.bytes === entry.asset.bytes && item.path.endsWith('.png'));
  assert.equal(bundledImage.length, 1, 'Exact companion PNG must be bundled once');
  await verifyInputs([{ path: record.artifact.path + '/' + bundledImage[0].path, sha256: entry.asset.sha256 }]);
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
for (const [reference, entryRef, buildId] of [[prior.pwa, entry.priorPwa, 'a507fa857ecdca73c69b2ad8d30feacf46e35adad6f9b1414bab980240f65544'],
  [prior.android, entry.priorAndroid, '26c5b44b4f70ff97bda0c1395fd6f0436653ff356a7d3a20bd953d575a9c44ae']]) {
  assert.deepEqual(reference, entryRef); const old = await verifyRef(reference);
  assert.equal(old.pass, true); assert.equal(old.buildId, buildId); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// Preflight every document and prepare every replacement before any state write.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S15');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const expectedStatuses = statuses(), countStages = () => Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(countStages(), { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'NOT_STARTED');
assert.equal(state.verificationCache.s13LibraryWindowDepth.path, entry.previous); await verifyRef(state.verificationCache.s13LibraryWindowDepth);
assert.equal(state.verificationCache.s15PlanetkaVisualMode, undefined);
const criterionIds = ['S15.PLANETKA-001', 'S15.PLANETKA-002'];
for (const id of criterionIds) assert.equal(stage.criteria.find(item => item.id === id).status, 'OPEN');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s15-planetka-visual-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D150:/gmu)].length, 1); assert.equal(/^- D151:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const criterionChanges = criterionIds.map(id => ({ id, from: 'OPEN', to: 'IN_PROGRESS' }));
const limitations = ['Independent adult DOM companion uses one 3D-rendered PNG bitmap, not a live 3D mascot mesh and never a transformed globe.',
  'Authored navigation tips and transient UI tours reuse canonical controls; they do not establish reviewed sourced literary dialogue, age-adaptive journeys, semantic journey persistence or audio readiness.',
  'Chrome runs actual App/renderer source with controlled native ports; installed-device and full accessibility acceptance are not established.',
  'Artwork provenance and inspected screenshots are recorded without formal art, rights, child or release acceptance.',
  'Earlier a1 reports concern the explicitly superseded on-globe visual contract and are preserved as historical attempts, including its browser failure.',
  'Historical Starter inventory remains bound to the earlier source; changed mappings are explicit and no inventory audit was rerun.'];
const nextAction = 'Continue the full application plan with the separate Книжулик / Mr. Booky DOM companion and existing canonical navigation. Keep the globe geometry, renderer, camera and picking independent of the companion. Preserve authored routes, keyboard behavior, hide/collapse/suspension semantics, 320px layout and PNG provenance; continue reviewed bilingual assistance and offline/error handling within actual source/rights gates. S03 remains the first unresolved acceptance. Child, literary journey persistence, dialogue/audio review, installed-device, screen-reader, distributed sync, iOS and release acceptance remain open.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'INDEPENDENT_DOM_COMPANION_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, earlierAttempts, supersededHarness: entry.supersededHarness,
  runs, sourceManifest, unitCount, unitFiles, browserCases: 1,
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  artwork: entry.asset, assetProvenance: await ref(folder + '/asset-provenance.json'), assetBundledByteExact: true,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryHistorical: true, inventoryReusedWithCurrentInputsVerified: false,
  inventoryUnchangedInputsVerified: true, inventoryChangedInputs, inventoryAuditRerun: false,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 }, ownerAdditionIds: prior.ownerAdditionIds,
  preservedInputs: entry.preservedInputs, changedInputsBefore: entry.changedInputsBefore, newSourcePaths: entry.newSourcePaths,
  priorVisualReview: prior.visualReview, priorSceneVisualReview: prior.priorSceneVisualReview,
  priorArtReview: prior.priorArtReview, priorArtCapture: prior.priorArtCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD151Recorded: true, criteriaUpdated: criterionIds, criterionChanges, stageChanges: [{ id: 'S15', from: 'NOT_STARTED', to: 'IN_PROGRESS' }],
  otherStageAndCriterionStatusesUnchanged: true, parallelSafeEntry: entry.parallelEntry,
  limitations, priorStorageLimitations: prior.priorStorageLimitations, inheritedReadingLibraryLimitations: prior.inheritedReadingLibraryLimitations,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true, installedNativeDevice: false,
  independentDomCompanion: true, liveMascot3DMesh: false, globeConvertedToCharacter: false,
  showHideDoesNotMoveCamera: true, stepsDoNotOwnCamera: true, sameSceneAndAtlas: true,
  canonicalWriterAndBooksNavigation: true, canonicalAuthorFilterApplied: true, honestRouteCompletion: true, manualAuthorFilterFencesCompletion: true, appearanceUsesCanonicalControls: true, collectionKeyboardPriority: true, collectionSearchFocusRestored: true, noAppearanceOrProfileWrites: true,
  semanticTourSurvivesLocale: true, hideCancelsTour: true, visibilitySuspendsWithoutPopup: true,
  finalGeometrySuitesRun: false, unchangedGeometrySuitesRerun: false, newActualAppCapture: true, isolatedArtCapture: false,
  artAccepted: false, userRealismRequirementSatisfied: false, childProfileCreated: false, childAccessGranted: false,
  childApproval: false, rightsApproval: false, reviewedDialogueAccepted: false, narrationEnabled: false,
  ageAdaptiveJourneysEnabled: false, semanticJourneyPersistence: false, screenReaderAcceptance: false,
  devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, folder + '/asset-provenance.json', sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
stage.status = 'IN_PROGRESS';
for (const id of criterionIds) {
  const criterion = stage.criteria.find(item => item.id === id); push(criterion.evidence, resultPath);
  criterion.status = 'IN_PROGRESS'; criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt;
  criterion.notes += ` Following the owner's explicit revised contract, Книжулик / Mr. Booky is an independent DOM companion using an original green 3D-rendered PNG, not facial/limb objects attached to the globe. Show/hide, contextual navigation help, next/back/collapse and real country/writer/collection actions leave the canonical renderer, atlas and camera ownership intact. ${unitCount} cases in the two selected controller/author-request suites, TypeScript and one actual-App Chrome case cover locale/320px/landscape layout, actual highlighted controls, writer selection and collection keyboard behavior. Forty-three established inputs including all globe/rig/geometry owners remain byte-exact; the PNG is bound into local PWA/Android artifacts. This is scoped IN_PROGRESS evidence only; reviewed dialogue, literary journeys, art, child, rights, device and release gates remain open.`;
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S15 independent DOM companion: ${unitCount} controller/author-request cases, TypeScript, one actual-App Chrome case, three inspected product-control views and exact local PWA/Android builds with the pinned PNG. Forty-three prior runtime sources unchanged. Superseded a1 retained; historical Starter inventory retained with explicit drift. No art/child/rights/device/release acceptance.`);
state.verificationCache.s15PlanetkaVisualMode = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
const expectedS15 = expectedStatuses.find(item => item[0] === 'S15'); expectedS15[1] = 'IN_PROGRESS';
for (const criterion of expectedS15[2]) if (criterionIds.includes(criterion[0])) criterion[1] = 'IN_PROGRESS';
assert.deepEqual(statuses(), expectedStatuses); const counts = countStages();
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 }); assert.equal(state.currentStageId, 'S03');
const decision = `
- D151: Follow the owner's revised contract: Книжулик / Mr. Booky is a separate optional DOM pet with a green 3D-rendered PNG, never a character conversion of the globe. Source ${sourceCommit}: ${unitCount} controller/author-request cases, TypeScript, one actual-App Chrome case, three inspected RU/EN views at desktop/320px/landscape and local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)} with exact bundled artwork. Canonical scene/camera/atlas ownership remains byte-exact. Authored transient navigation tours use real country/writer/collection controls and canonical author filtering, with next/back/highlighting, truthful completion, explicit resume after background and collection keyboard priority. S15 and only PLANETKA-001/002 become IN_PROGRESS; S03 remains first unresolved. Earlier on-globe a1 attempts and their failed browser result remain preserved as superseded history. Forty-three established inputs remain unchanged; historical Starter inventory remains 29/13/0 plus three owner additions with explicit drift. Reviewed dialogue, age-adaptive literary journeys, art/rights/child/device/release gates remain open. Evidence: evidence/S15/planetka-visual-mode-20260920/result.json.
`;
const note = `${marker}
Source ${sourceCommit.slice(0, 8)} implements the separate Книжулик / Mr. Booky DOM companion requested by the owner. The green asset is a 3D-rendered PNG, not a live mascot mesh; the globe remains unchanged.
${unitCount} selected controller/author-request cases, TypeScript, one actual-App Chrome case and one PWA offline smoke pass. Three inspected RU/EN desktop/320px/landscape views bind the full imported image and functional navigation UI.
S15 and only S15.PLANETKA-001/002 are IN_PROGRESS. Forty-three established sources remain unchanged; superseded a1 remains historical. Starter inventory stays historical 29/13/0 plus three owner additions with explicit drift.
PWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S15/planetka-visual-mode-20260920/result.json.
Stages: 3 complete, 12 in progress, 26 unstarted; first open S03. No art/child/device/release acceptance is claimed.
${nextAction}
<!-- s15-planetka-visual-20260920:end -->

`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalDocs.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, counts, firstOpen: 'S03', criterionChanges, otherStageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
