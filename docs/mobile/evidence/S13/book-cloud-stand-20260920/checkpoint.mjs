import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Validate existing evidence only. No test, build, inventory or capture runs.
// Usage: node <this-file> <source40> [browserAttempt=a1] [unitAttempt=a1] [staticAttempt=a1]
const [sourceCommit, browserAttempt = 'a1', unitAttempt = 'a1', staticAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [browserAttempt, unitAttempt, staticAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/book-cloud-stand-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-book-cloud';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/book-cloud-stand.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const required = ['src/components/globeBookCloudStandGeometry.ts', 'src/components/globeStandGeometry.ts',
  'src/planet/globeStands.ts', 'src/host/PlanetStandControls.tsx'];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S13'); assert.equal(entry.checkpoint, 'eee52501adf0277c5180d3fec0033a8300c784e5');
assert.equal(entry.previous, 'docs/mobile/evidence/S11/storage-status-20260920/result.json');
assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 32); await verifyInputs(entry.preservedInputs);
const compositionOwners = ['src/planet/globeComposition.ts', 'src/host/planetComposition.ts', 'src/host/planetCompositionPresentation.ts',
  'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts', 'src/components/globeAtlas.ts', 'src/components/useGlobeStyleState.ts'];
requireInputs(entry.preservedInputs, compositionOwners);
assert.deepEqual(entry.changedInputsBefore.map(item => item.path).sort(), ['scripts/mobile/audit-starter-set.mjs',
  'src/components/globeStandGeometry.ts', 'src/host/PlanetStandControls.tsx', 'src/planet/globeStands.ts']);
for (const item of entry.changedInputsBefore) {
  assert.equal(item.sourceCommit, entry.checkpoint);
  assert.equal(sha(execFileSync('git', ['show', entry.checkpoint + ':' + item.path], { windowsHide: true, env: process.env })), item.gitBlobSha256);
}
assert.deepEqual(entry.newSourcePaths, ['src/components/globeBookCloudStandGeometry.ts']);
await verifyInputs([prior.visualReview, prior.priorVisualReview, prior.priorSceneVisualReview, prior.priorArtReview, prior.priorArtCapture]);
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath), oldInventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.auditValid, true); await verifyInputs(inventory.sourceInputs);
noApproval(inventory, ['stageAccepted', 'grantsEntitlement', 'productionActionsPerformed', 'releaseReady']);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 13, 0, 3]);
assert.deepEqual(inventory.items.map(item => item.id), oldInventory.items.map(item => item.id));
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), oldInventory.ownerAdditions.map(item => item.id).sort());
const cloud = inventory.items.find(item => item.requirementId === 'STARTER-009');
assert.equal(cloud.id, 'stand.base.child-book-cloud'); assert.equal(cloud.implementation.status, 'source-present');
requireInputs(cloud.implementation.sources); await verifyInputs(cloud.implementation.sources);
assert.equal(cloud.checks.childAgeReview, 'open'); assert.equal(cloud.iapSkuAllowed, false);
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }

const unitFiles = ['src/components/globeBookCloudStandGeometry.test.ts', 'src/host/HostPlatformServices.test.ts',
  'src/host/planetStandCustomization.test.ts', 'src/planet/globeComposition.test.ts'], units = await read(`${folder}/unit-${unitAttempt}/vitest.json`);
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
    const reason = mode === 'browser' && number === 1
      ? 'Passed on the earlier source, but country-focused zoom hid the stand in tier images; subsequent captures use an overview reached with actual zoom and drag controls.'
      : mode === 'browser' && number === 2
        ? 'Failed on unchanged current runtime because the fixture checked zoom-out availability before the preceding dolly settled; the next fixture waits for idle and stable pose before each availability check.'
        : 'Earlier source validation retained unchanged; the factory visual refinement superseded its source binding.';
    earlierAttempts.push({ ...await ref(file), mode, attempt, pass: report.pass, tests: report.tests,
      sourceManifest: report.sourceManifest, supersededSource: report.sourceManifest.sha256 !== sourceManifest.sha256, reason });
  }
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.equal(path.basename(specs[0].file.replaceAll('\\', '/')), 'book-cloud-stand.spec.mjs');
const copies = attachments.filter(item => item.name === 'book-cloud-stand-source-evidence' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'book-cloud-stand.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true, key);
noApproval(app, ['artAccepted', 'childReviewed', 'installedNative', 'devicePerformanceAccepted', 'releaseReady']);
for (const key of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[key], []);
await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs);
assert.ok(app.observations && !Array.isArray(app.observations));
for (const name of ['baseline', 'draft', 'cancelled', 'combinedApplied', 'high', 'balanced', 'economy', 'highClose', 'restoredAfterClose', 'narrow']) {
  assert.ok(app.observations[name] && typeof app.observations[name] === 'object', name);
}
const images = await Promise.all(['book-cloud-high-ru-1440.png', 'book-cloud-balanced-ru-1440.png', 'book-cloud-economy-ru-1440.png',
  'book-cloud-high-inspection-close.png', 'book-cloud-combined-preview-en-390.png'].map(name => ref(path.join(path.dirname(actualAppCapture.path), name))));
assert.equal(app.screenshots.length, images.length);
for (const image of images) {
  const recorded = app.screenshots.filter(item => item.filename === path.basename(image.path));
  assert.equal(recorded.length, 1); assert.equal(recorded[0].sha256, image.sha256);
}
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
assert.equal(normalized(visual.actualAppCapture.path), normalized(actualAppCapture.path)); assert.equal(visual.actualAppCapture.sha256, actualAppCapture.sha256);
noApproval(visual, ['artAccepted', 'childApproved', 'userRealismRequirementSatisfied', 'releaseReady']);
assert.equal(visual.images.length, 5); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, 5);
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
for (const [reference, entryRef, buildId] of [[prior.pwa, entry.priorPwa, '36e98c637d1486599f6f1e95fbe3a3128b9a2ec41c8ad67dea4be379f89d9a09'],
  [prior.android, entry.priorAndroid, 'ac6bb18db5b0189e75df5ec4c22362476e12468f30858942825bf8357661afea']]) {
  assert.deepEqual(reference, entryRef); const old = await verifyRef(reference);
  assert.equal(old.pass, true); assert.equal(old.buildId, buildId); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// Preflight every document and prepare every replacement before any state write.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S13');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const expectedStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s11StorageStatus.path, entry.previous); await verifyRef(state.verificationCache.s11StorageStatus);
assert.equal(state.verificationCache.s13BookCloudStand, undefined);
const criterionIds = ['S13.CUSTOM-001'];
for (const id of criterionIds) assert.equal(stage.criteria.find(item => item.id === id).status, 'IN_PROGRESS');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s13-book-cloud-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D145:/gmu)].length, 1); assert.equal(/^- D146:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const limitations = ['STARTER-009 gains an adult source binding; child age review, rights and formal art acceptance remain open.',
  'The close inspection view is temporary test-only camera framing with restoration, not a new user navigation mode.',
  'Chrome executes the actual application source with controlled native ports; installed-device behavior is not established.',
  'Source presence, scoped resource checks and visual inspection do not establish full catalog, stress, device or release acceptance.'];
const nextAction = 'Continue the full application plan from the next bounded internal requirement. Preserve the new adult book-cloud stand, its existing whole-composition preview/apply/cancel ownership, and all established scene, reader, locale and storage behavior. Continue remaining Starter Set/source bindings and functional gaps without repeating unchanged geometry suites. Child/rights/art/lightmap review, full accessories/audio/catalog, screen-reader, installed-device/stress, actual storage retention, distributed sync/conflict resolution, iOS and release gates remain open.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'BOOK_CLOUD_STAND_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, earlierAttempts, runs, sourceManifest, unitCount, unitFiles, browserCases: 1,
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  starterSetSourceInventory: await ref(inventoryPath), inventoryHistorical: false, inventoryCurrentInputsVerified: true, freshInventoryAuditPerformed: true,
  priorStarterSetSourceInventory: prior.starterSetSourceInventory, priorInventoryHistorical: true,
  requiredStarterItems: 29, sourceBoundStarterItems: 13, acceptedStarterItems: 0, ownerAddedCount: 3, ownerAdditionIds: prior.ownerAdditionIds,
  preservedInputs: entry.preservedInputs, changedInputsBefore: entry.changedInputsBefore,
  priorVisualReview: prior.visualReview, priorSceneVisualReview: prior.priorSceneVisualReview,
  priorArtReview: prior.priorArtReview, priorArtCapture: prior.priorArtCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD146Recorded: true, criteriaUpdated: criterionIds, criterionChanges: [], stageAndCriterionStatusesUnchanged: true,
  limitations, priorStorageLimitations: prior.limitations, inheritedReadingLibraryLimitations: prior.inheritedReadingLibraryLimitations,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true, installedNativeDevice: false,
  newStandGeometryVerified: true, unchangedGeometrySuitesRerun: false, newActualAppCapture: true, isolatedArtCapture: false, artAccepted: false,
  likenessAccepted: false, userRealismRequirementSatisfied: false, childApproval: false, rightsApproval: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, inventoryPath, sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const id of criterionIds) {
  const criterion = stage.criteria.find(item => item.id === id); push(criterion.evidence, resultPath);
  criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt;
  criterion.notes += ` STARTER-009 now has an original adult book-cloud stand source binding through the existing composition and resource owners. Fresh inventory records 13/29 mandatory items source-bound, zero accepted, and the same three separate owner additions. ${unitCount} cases across four selected geometry/port/controller/compatibility suites, TypeScript and one actual-App Chrome case bind inspected tier/locale views and local PWA/Android artifacts. Seven composition owners and established portrait/whale/background/reader/locale/storage inputs remain unchanged. Child age review, rights, art, full catalog/stress and installed-device acceptance remain open.`;
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S13 book-cloud stand: ${unitCount} cases across the four selected suites, TypeScript, one actual-App Chrome case and exact local PWA/Android builds. Thirty-two established runtime inputs including seven composition owners remain unchanged. Fresh Starter Set inventory is 29 required / 13 source-bound / zero accepted plus three owner additions. Existing geometry suites were not rerun; child/rights/art, full catalog/stress and installed-device acceptance remain open.`);
state.verificationCache.s13BookCloudStand = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
const decision = `\n- D146: Bind STARTER-009 to an original adult book-cloud stand using the existing scene, composition and resource owners. Source ${sourceCommit} has ${unitCount} cases across four selected suites, TypeScript, one actual-App Chrome case, inspected tier/locale views, and local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. S13.CUSTOM-001 receives scoped evidence only; all criterion and stage statuses stay unchanged. Thirty-two established runtime inputs and seven composition owners are retained. Fresh Starter Set inventory records 29 required / 13 source-bound / zero accepted plus three separate owner additions. The child-oriented mandatory item remains unaccepted; child age review, rights/art/lightmap, full catalog/stress, installed-device and release gates remain open. Evidence: evidence/S13/book-cloud-stand-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds the original adult book-cloud stand through existing composition preview/apply/cancel and resource owners.\n${unitCount} cases across four selected suites, TypeScript, one actual-App Chrome case and one PWA offline smoke pass. Tier/locale images are inspected evidence, not formal art or child approval.\nS13.CUSTOM-001 receives evidence only; all criterion and stage statuses remain unchanged. Thirty-two established runtime sources are retained. Fresh Starter Set inventory: 29 required / 13 source-bound / zero accepted, plus three separate owner additions.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S13/book-cloud-stand-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s13-book-cloud-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalDocs.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, counts, firstOpen: 'S03', criterionChanges: result.criterionChanges, stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
