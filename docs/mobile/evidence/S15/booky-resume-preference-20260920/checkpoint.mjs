import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Run from the V12 checkout AFTER the source commit, selected final checks,
// actual visual inspection and preserved builds. Runs no tests/builds/captures.
// node <this-file> <source40> <browserAttempt> <unitAttempt> <staticAttempt> [pwaAttempt=a1] [androidAttempt=a1]
const [sourceCommit, browserAttempt, unitAttempt, staticAttempt, pwaAttempt = 'a1', androidAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [browserAttempt, unitAttempt, staticAttempt, pwaAttempt, androidAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/booky-resume-preference-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-resume';
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const gitIdentityDifferences = new Map();
const utf8TextExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.txt', '.csv', '.svg', '.geojson']);
async function verifyGitIdentity(commit, input) {
  const blob = gitBytes(['show', commit + ':' + input.path]), gitBlobSha256 = sha(blob);
  if (gitBlobSha256 === input.sha256) return;
  // Historical checkout CRLF conversion is acceptable only for explicitly
  // allowlisted UTF-8 text. Current evidence still binds exact disk bytes.
  assert.ok(utf8TextExtensions.has(path.extname(input.path)), 'Non-text Git identity differs: ' + input.path);
  const checkedOut = await fs.readFile(input.path);
  assert.equal(sha(checkedOut), input.sha256, 'Checked-out identity: ' + input.path);
  const blobText = blob.toString('utf8'), checkedOutText = checkedOut.toString('utf8');
  assert.ok(Buffer.from(blobText, 'utf8').equals(blob), 'Git blob is not round-trip UTF-8: ' + input.path);
  assert.ok(Buffer.from(checkedOutText, 'utf8').equals(checkedOut), 'Checkout is not round-trip UTF-8: ' + input.path);
  assert.equal(blobText.replaceAll('\r\n', '\n'), checkedOutText.replaceAll('\r\n', '\n'), 'Git content drift: ' + input.path);
  gitIdentityDifferences.set(commit + ':' + input.path, { commit, path: input.path,
    gitBlobSha256, checkedOutSha256: input.sha256, lineEndingOnly: true });
}
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/booky-resume-preference.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length);
  assert.equal(new Set(inputs.map(item => normalized(item.path))).size, inputs.length);
  for (const item of inputs) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
  }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
async function optionalRef(file) {
  try { return await ref(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => {
  for (const flag of flags) assert.equal(record[flag], false, flag);
};
const changed = ['src/App.tsx', 'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css',
  'src/host/planetMascot.ts', 'src/host/HostPlatformServices.ts', 'src/platform/adapters/web/WebPlatformAdapter.ts'];
const added = ['src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts'];
const required = [...changed, ...added];
const unitFiles = ['src/host/planetMascot.test.ts', 'src/host/planetMascotPersistence.test.ts',
  'src/host/HostPlatformServices.test.ts', 'src/platform/adapters/web/WebPlatformAdapter.test.ts'];
const requireInputs = (inputs, files = required) => {
  for (const file of files) assert.ok(inputs.some(item => item.path === file), 'Missing source binding: ' + file);
};
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S15'); assert.equal(entry.checkpoint, '8e1bf53e9d25ba14b09d98598b61ad0173d6b4ce');
assert.equal(entry.previous, 'docs/mobile/evidence/S15/booky-live-character-20260920/result.json');
assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.childApproved, false);
assert.ok(entry.ownerClarification.includes('All former Planetka functional requirements'));
assert.ok(entry.ownerClarification.includes('Child scenarios, reviewed dialogue, audio, educational journeys and full progress remain in scope'));
assert.notEqual(sourceCommit, entry.checkpoint); git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]);
assert.deepEqual(entry.changedInputsBefore.map(item => item.path).sort(), [...changed].sort());
assert.deepEqual([...entry.newSourcePaths].sort(), [...added].sort());
await verifyInputs(entry.preservedInputs);
requireInputs(entry.preservedInputs, ['src/components/GlobeCameraRig.tsx', 'src/components/LiteraryGlobe.tsx',
  'src/components/LiteraryWorldMap.tsx', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
  'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts',
  'src/host/planetMascotRoutes.ts', 'src/assets/mascots/knizhulyk-green-v1.png']);
for (const item of entry.preservedInputs) await verifyGitIdentity(entry.checkpoint, item);
for (const item of entry.changedInputsBefore) {
  assert.equal(item.sourceCommit, entry.checkpoint);
  assert.equal(sha(gitBytes(['show', entry.checkpoint + ':' + item.path])), item.gitBlobSha256, item.path);
}
await verifyInputs([prior.visualReview]);
assert.deepEqual(entry.priorStarterSetSourceInventory, prior.starterSetSourceInventory);
assert.equal(entry.inventoryHandling, 'historical-with-explicit-changed-inputs');
const inventory = await verifyRef(prior.starterSetSourceInventory), inventoryChangedInputs = [];
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 13, 0, 3]);
noApproval(inventory, ['stageAccepted', 'grantsEntitlement', 'productionActionsPerformed', 'releaseReady']);
const inheritedChanges = new Map(prior.inventoryChangedInputs.map(item => [item.path, item]));
for (const item of inventory.sourceInputs) {
  const current = await ref(item.path), inherited = inheritedChanges.get(item.path);
  if (inherited) assert.equal(inherited.priorSha256, item.sha256);
  if (!changed.includes(item.path)) assert.equal(current.sha256, inherited?.currentSha256 ?? item.sha256, 'Historical inventory source drift: ' + item.path);
  if (current.sha256 !== item.sha256) inventoryChangedInputs.push({ path: item.path, priorSha256: item.sha256, currentSha256: current.sha256 });
}

const units = await read(`${folder}/unit-${unitAttempt}/vitest.json`);
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
  const manifest = await verifyRef(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, report.sourceManifest.fileCount); await verifyInputs(manifest.files); requireInputs(manifest.files);
  for (const input of manifest.files) await verifyGitIdentity(sourceCommit, input);
  await verifyInputs(report.checkInputs);
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest); else sourceManifest = report.sourceManifest;
  assert.deepEqual(report.tests, mode === 'unit' ? { passed: unitCount, failed: 0, skipped: 0 }
    : mode === 'browser' ? { passed: 1, failed: 0, skipped: 0, flaky: 0 } : null);
  const executionFile = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionFile);
  assert.equal(execution.exitCode, 0); await verifyInputs([execution.stdout, execution.stderr]);
  runs[mode] = { ...await ref(file), tests: report.tests, execution: await ref(executionFile),
    rawReport: mode === 'static' ? null : await ref(`${folder}/${mode}-${attempt}/${mode === 'unit' ? 'vitest' : 'playwright'}.json`) };
}
const earlierAttempts = [];
for (const [mode, finalAttempt] of Object.entries(attempts)) {
  for (let n = 1; n < Number(finalAttempt.slice(1)); n++) {
    const attempt = 'a' + n, file = `${folder}/${mode}-${attempt}/result.json`;
    let report; try { report = await read(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); noApproval(report);
    await verifyRef(report.sourceManifest); // Verify historical bytes, not historical source against current source.
    if (report.sourceManifestAfter) await verifyRef(report.sourceManifestAfter);
    const executionFile = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionFile);
    await verifyInputs([execution.stdout, execution.stderr]);
    earlierAttempts.push({ ...await ref(file), mode, attempt, pass: report.pass, tests: report.tests,
      sourceManifest: report.sourceManifest, execution: await ref(executionFile),
      rawReport: mode === 'static' ? null : await optionalRef(`${folder}/${mode}-${attempt}/${mode === 'unit' ? 'vitest' : 'playwright'}.json`),
      supersededSource: report.sourceManifest.sha256 !== sourceManifest.sha256,
      reason: mode === 'unit' && attempt === 'a1'
        ? '205 passing cases and one obsolete WebPlatformAdapter stand expectation. book-cloud is a valid adult choice; original failed report remains unchanged.'
        : mode === 'unit' && attempt === 'a2'
          ? 'Sandbox denied esbuild startup before tests or a Vitest report were produced. Preserve tests:null and raw execution logs; do not count this attempt as product validation.'
          : 'Earlier attempt retained unchanged. Only the explicitly selected final source-bound attempt counts as current validation.' });
  }
}
assert.ok(earlierAttempts.some(item => item.mode === 'unit' && item.attempt === 'a1' && item.pass === false), 'Preserve failed unit a1');

const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]);
assert.deepEqual(browser.errors, []);
const visit = suite => {
  for (const spec of suite.specs ?? []) {
    specs.push(spec);
    for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []);
  }
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.equal(path.basename(specs[0].file.replaceAll('\\', '/')), 'booky-resume-preference.spec.mjs');
const copies = attachments.filter(item => item.name === 'booky-resume-preference-source-evidence' && item.path);
assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'booky-resume-preference.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
const verifiedClaims = ['pass', 'actualApp', 'actualCss', 'actualGlobe', 'closedOfferAfterLoad', 'explicitSemanticResume',
  'noAutomaticNavigation', 'hideSurvivesReload', 'semanticStepIdPersisted', 'failedWriteDoesNotRevertUi',
  'explicitRetrySavesCurrentValue', 'retryRestoresHeadingFocus', 'localeRetainsOffer', 'narrowOfferFits',
  'sameCanonicalSceneWithinEachLoad', 'noAppearanceWrites', 'coldReadFailureRetryReachable',
  'readRetryPreservesSavedRoute', 'failedHideRetryReachable', 'hideRetryKeepsCompanionHidden',
  'closedRetryRestoresToggleFocus', 'narrowClosedFailuresFit', 'noDuplicatePersistenceNotices'];
for (const key of verifiedClaims) assert.equal(app[key], true, key);
noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
  'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
for (const key of ['errors', 'externalRequests', 'missingResources', 'customizationWrites', 'unexpectedPreferenceWrites']) assert.deepEqual(app[key], []);
await verifyInputs(app.sourceInputs);
requireInputs(app.sourceInputs, required.filter(file => file !== 'src/platform/adapters/web/WebPlatformAdapter.ts'));
const manifestFiles = (await read(sourceManifest.path)).files;
for (const item of app.sourceInputs.filter(item => required.includes(item.path))) {
  assert.ok(manifestFiles.some(source => source.path === item.path && source.sha256 === item.sha256));
}
for (const name of ['coldRestored', 'offerRu', 'offerEn320', 'resumedWithoutNavigation', 'hidden',
  'hiddenAfterReload', 'savedSemanticStep', 'failedSaveKeepsCurrentStep', 'retryConfirmedCurrentStep',
  'coldReadFailure', 'readRetryRestoresClosedOffer', 'failedHide']) {
  assert.ok(app.observations?.[name] && typeof app.observations[name] === 'object', name);
}
assert.equal(app.fallbackArtwork.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
assert.equal(app.fallbackArtwork.path, 'src/assets/mascots/knizhulyk-green-v1.png');
assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.fallbackArtwork.bundledPath && item.sha256 === app.fallbackArtwork.sha256));
assert.ok(app.screenshots.length > 0); assert.equal(new Set(app.screenshots.map(item => item.filename)).size, app.screenshots.length);
for (const filename of ['booky-resume-offer-en-320.png', 'booky-read-failure-ru-320.png', 'booky-hide-failure-en-320.png']) {
  assert.ok(app.screenshots.some(item => item.filename === filename), filename);
}
const images = app.screenshots.map(item => {
  assert.match(item.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(item.framing?.trim());
  return { path: path.join(path.dirname(actualAppCapture.path), item.filename), sha256: item.sha256 };
});
await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
assert.equal(normalized(visual.actualAppCapture.path), normalized(actualAppCapture.path)); assert.equal(visual.actualAppCapture.sha256, actualAppCapture.sha256);
noApproval(visual, ['artAccepted', 'childApproved', 'releaseReady']);
assert.equal(visual.images.length, images.length); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, images.length);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.ok(typeof image.reviewer === 'string' && image.reviewer.trim());
  assert.ok(Array.isArray(image.findings) && image.findings.length && image.findings.every(item => typeof item === 'string' && item.trim()));
  assert.ok(images.some(known => normalized(known.path) === normalized(image.path) && known.sha256 === image.sha256));
  await verifyInputs([image]);
}

const pwaPath = `${folder}/pwa-${pwaAttempt}/result.json`, androidPath = `${folder}/android-${androidAttempt}/result.json`;
const pwa = await read(pwaPath), android = await read(androidPath);
for (const record of [pwa, android]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  noApproval(record, ['stageAccepted', 'releaseReady', 'productionActionsPerformed']);
  assert.ok(normalized(record.artifact.path).startsWith(artifacts + '/'));
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: record.artifact.artifactSha256 ?? record.artifact.sha256 });
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files); requireInputs(manifest.sourceInputs.files);
  for (const file of required) assert.ok(manifest.sourceInputs.files.some(item => item.path === file && manifestFiles.some(source => source.path === file && source.sha256 === item.sha256)));
  const fallback = manifest.inventory.filter(item => item.sha256 === app.fallbackArtwork.sha256 && item.bytes === app.fallbackArtwork.bytes && item.path.endsWith('.png'));
  assert.equal(fallback.length, 1);
  await verifyInputs([{ path: record.artifact.path + '/' + fallback[0].path, sha256: app.fallbackArtwork.sha256 }]);
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
assert.equal(pwa.localQaAuthority, true); assert.equal(pwa.installedDevice, false);
assert.equal(android.nativeExecutionVerified, false); assert.equal(android.iosCompiled, false);
const pwaBrowser = await read(`${folder}/pwa-${pwaAttempt}/playwright.json`);
assert.deepEqual([pwaBrowser.stats.expected, pwaBrowser.stats.unexpected, pwaBrowser.stats.skipped, pwaBrowser.stats.flaky], [1, 0, 0, 0]);
assert.deepEqual(pwaBrowser.errors, []);
const buildAudits = [];
for (const [kind, file] of [['pwa', `${folder}/pwa-${pwaAttempt}/strict-audit.json`],
  ...Object.entries(android.checks).filter(([key]) => ['strictRuntimeAudit', 'binaryAudit', 'build'].includes(key))]) {
  const audit = await read(file); assert.equal(audit.pass, true);
  const identity = kind === 'binaryAudit' ? audit.sourceArtifact : kind === 'build' ? audit : audit.identity;
  assert.equal(identity.sourceCommit, sourceCommit); assert.equal(identity.buildId, kind === 'pwa' ? pwa.buildId : android.buildId);
  if (kind === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); await verifyInputs([...audit.rawReports, audit.zip.ledger]); }
  buildAudits.push(await ref(file));
}
assert.equal(buildAudits.length, 4);
const copyPath = `${folder}/pwa-${pwaAttempt}/copy-verification.json`, copy = await read(copyPath);
assert.equal(copy.pass, true); assert.equal(copy.files, pwa.artifact.files); assert.equal(copy.bytes, pwa.artifact.bytes);
assert.equal(copy.artifactManifest.sha256, pwa.artifact.artifactSha256); await verifyInputs([copy.detailedLedger, copy.artifactManifest]);
await verifyInputs([android.apk]); assert.equal((await fs.stat(android.apk.path)).size, android.apk.bytes);
for (const [reference, entryRef] of [[prior.pwa, entry.priorPwa], [prior.android, entry.priorAndroid]]) {
  assert.deepEqual(reference, entryRef); const old = await verifyRef(reference);
  assert.equal(old.pass, true); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// Validate and prepare all mutations before writing. Historical source/build
// evidence remains referenced once; no copied screenshots or full inventories.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md',
  'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/REQUIREMENTS_TRACEABILITY.json', 'docs/mobile/REQUIREMENTS_TRACEABILITY.csv'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S15');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const beforeStatuses = statuses(), expectedStatuses = structuredClone(beforeStatuses);
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 });
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance');
assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance'); assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03');
assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s15BookyLiveCharacter.path, entry.previous); await verifyRef(state.verificationCache.s15BookyLiveCharacter);
assert.equal(state.verificationCache.s15BookyResumePreference, undefined);
for (const id of ['S15.PLANETKA-001', 'S15.PLANETKA-002']) assert.equal(stage.criteria.find(item => item.id === id).status, 'IN_PROGRESS');
const resumeCriterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-008'); assert.equal(resumeCriterion.status, 'OPEN');
expectedStatuses.find(item => item[0] === 'S15')[2].find(item => item[0] === 'S15.PLANETKA-008')[1] = 'IN_PROGRESS';
const trace = JSON.parse(originalDocs.get(globalFiles[5])), priorTrace = structuredClone(trace);
const resumeRequirement = trace.requirements.find(item => item.id === 'PLANETKA-008'); assert.equal(resumeRequirement.status, 'OPEN');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s15-booky-resume-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D152:/gmu)].length, 1); assert.equal(/^- D153:/mu.test(decisions), false);
for (const file of globalFiles.slice(2, 5)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue S15 with bounded RU/EN offline/error help for Книжулик / Mr. Booky using existing platform/network/storage state and explicit recovery controls. Preserve the live character, all canonical globe scenes, art and resource ownership. All former Planetka functions remain Booky scope: child scenarios, reviewed dialogue/audio, educational journeys and full progress; the character replacement does not remove them. Adult navigation-tour resume is a partial foundation only; child policy, full journey migration, art, screen-reader, installed-device/performance, iOS and release gates remain open. S03.acceptance remains first unresolved.';
const limitations = [
  'The restored adult record contains explicit visibility and a semantic navigation-tour step only. Restore does not navigate, open help, restore entity permissions, invent reading completion or grant access.',
  'Adult navigation progress is a partial PLANETKA-008 foundation. Child profiles, educational/literary journey progress and full migration acceptance remain pending under the same immutable requirement IDs.',
  'Source Chrome executes the actual App/CSS/globe with controlled native OS/preferences ports. It does not establish installed-device, screen-reader, battery or performance acceptance.',
  'The built-PWA case is the existing offline/download smoke. Build manifests bind the current Booky runtime, but no separate built-PWA Booky-resume execution is claimed.',
  'RU/EN help and recovery copy remains draft. Screenshot inspection is scoped layout evidence, not editorial, child or formal art approval.',
  'The canonical scene, original live Booky model/renderer/art and protected inputs remain byte-exact; unchanged geometry/controller suites and historic art audits were not repeated.',
  'Prior artifacts and failed attempts remain preserved. Starter inventory remains historical 29/13/0 plus three owner additions with explicit changed input bindings.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_PREFERENCE_RESUME_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), checkpointHelper: await ref(fileURLToPath(import.meta.url)),
  ownerClarification: entry.ownerClarification, attempts: { ...attempts, pwa: pwaAttempt, android: androidAttempt },
  earlierAttempts, runs, sourceManifest, unitCount, unitFiles, browserCases: 1,
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true,
  validatedBehavior: Object.fromEntries(verifiedClaims.filter(key => !['pass', 'actualApp', 'actualCss', 'actualGlobe'].includes(key)).map(key => [key, app[key]])),
  visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  protectedInputCount: entry.preservedInputs.length, preservedInputsVerified: true,
  gitIdentityDifferences: [...gitIdentityDifferences.values()],
  changedSourcePaths: changed, newSourcePaths: added,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryHistorical: true, inventoryAuditRerun: false,
  inventoryUnchangedInputsVerified: true, inventoryChangedInputs,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId,
  apk: android.apk, buildAudits, copyVerification: await ref(copyPath), pwaBrowserReport: await ref(`${folder}/pwa-${pwaAttempt}/playwright.json`),
  priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD153Recorded: true, criteriaUpdated: ['S15.PLANETKA-008'],
  criterionChanges: [{ id: 'S15.PLANETKA-008', before: 'OPEN', after: 'IN_PROGRESS' }],
  requirementChanges: [{ id: 'PLANETKA-008', before: 'OPEN', after: 'IN_PROGRESS' }],
  stageChanges: [], otherStageAndCriterionStatusesUnchanged: true, firstUnresolved: 'S03.acceptance',
  parallelSafeEntry: entry.parallelEntry, limitations, nextAction,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true,
  adultVisibilityPersisted: true, semanticNavigationTourResume: true, automaticResumeNavigation: false,
  artChanged: false, globeSceneChanged: false, installedNativeDevice: false, builtPwaBookyResumeExecution: false,
  artAccepted: false, childProfileCreated: false, childAccessGranted: false, childApproved: false,
  rightsApproval: false, reviewedDialogueAccepted: false, narrationEnabled: false, ageAdaptiveJourneysEnabled: false,
  literaryJourneyPersistence: false, childJourneyPersistence: false, fullJourneyMigrationAccepted: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path,
  ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
const scopedNote = ` Adult Booky explicit visibility and semantic navigation-tour resume now persist through existing adult platform preferences. Cold restoration offers a closed, explicit resume and does not navigate or grant permissions. ${unitCount} selected preference/controller/adapter cases, TypeScript, one actual-App Chrome case and ${visual.images.length} inspected source-bound views validate the selected source; current local PWA/Android artifacts preserve that runtime. This starts the adult foundation only; child and literary progress, migrations, reviewed dialogue/audio and all art/device/release acceptance remain pending. All former Planetka functions remain Booky scope.`;
resumeCriterion.status = 'IN_PROGRESS'; resumeCriterion.commit = sourceCommit; resumeCriterion.lastValidatedAt = recordedAt;
resumeCriterion.notes += scopedNote; push(resumeCriterion.evidence, resultPath);
resumeRequirement.status = 'IN_PROGRESS'; resumeRequirement.commit = sourceCommit; resumeRequirement.notes += scopedNote;
for (const file of required) push(resumeRequirement.implementationFiles, file);
for (const file of [...unitFiles, 'tests/pwa/booky-resume-preference.spec.mjs']) push(resumeRequirement.tests, file);
push(resumeRequirement.evidence, resultPath);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S15 adult Booky preference/resume: ${unitCount} focused cases, TypeScript, one actual-App browser case, ${visual.images.length} inspected views and bound local PWA/Android artifacts. Preserve earlier failed attempts. PLANETKA-008 is IN_PROGRESS only; child/literary/migration/art/device/release gates stay open.`);
state.verificationCache.s15BookyResumePreference = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
assert.deepEqual(trace.requirements.filter(item => item.id !== 'PLANETKA-008'), priorTrace.requirements.filter(item => item.id !== 'PLANETKA-008'));
const sourceRows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originalDocs.get(globalFiles[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(priorTrace, sourceRows));
const decision = `\n- D153: All former Planetka functional requirements belong to Книжулик / Mr. Booky; changing the character does not remove child scenarios, reviewed dialogue/audio, educational journeys or full progress. Source ${sourceCommit} implements the bounded adult preference foundation: explicit show/hide and semantic navigation-tour step persistence, closed cold-restore offer, deliberate resume without automatic navigation or permissions, truthful failure and explicit retry. ${unitCount} selected unit cases, TypeScript, one actual-App Chrome case and ${visual.images.length} inspected views bind this source. Local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)} preserve the runtime; the built-PWA test is the existing offline/download smoke, not a separate Booky-resume execution. The ${entry.preservedInputs.length} protected scene/model/art inputs remain unchanged. Only S15.PLANETKA-008 and global PLANETKA-008 advance OPEN to IN_PROGRESS; PLANETKA-001/002 stay IN_PROGRESS at S15. S03.acceptance remains first unresolved. No criterion passes and no child, full literary journey/migration, editorial, art, installed-device, iOS or release acceptance is claimed. Next: bounded RU/EN offline/error help using existing state/recovery controls. Evidence: evidence/S15/booky-resume-preference-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)}: adult Booky remembers explicit visibility and a semantic navigation-tour step. Cold restore leaves help closed and offers deliberate resume without automatic navigation or restored permissions. Failure/retry behavior is source-validated; child and literary journey progress remain pending.\n${unitCount} selected preference/controller/adapter cases, TypeScript, one actual-App Chrome case, ${visual.images.length} inspected views and local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)} bind this source. Built-PWA coverage is the existing offline/download smoke. ${entry.preservedInputs.length} protected scene/model/art inputs stay exact; original failed attempts remain preserved.\nOnly S15.PLANETKA-008/global PLANETKA-008 become IN_PROGRESS. S15 PLANETKA-001/002 stay IN_PROGRESS; all stage statuses stay unchanged (3 complete, 12 in progress, 26 unstarted). First unresolved S03.acceptance; releaseReady:false. All former Planetka functions remain Booky scope, including child scenarios, reviewed dialogue/audio, educational journeys and full progress.\nEvidence: evidence/S15/booky-resume-preference-20260920/result.json.\n${nextAction}\n<!-- s15-booky-resume-20260920:end -->\n\n`;
const readme = `# S15 adult Booky preference and resume\n\nSource: \`${sourceCommit}\`. Status: scoped local validation; S15 remains IN_PROGRESS and S03.acceptance remains first unresolved.\n\nAdult visibility and the current semantic navigation-tour step persist through existing platform preferences. Cold restore keeps help closed; deliberate resume does not navigate, select entities or confer permissions. Child/literary journeys and full migration remain pending. All former Planetka requirements belong to Booky.\n\nEvidence: ${unitCount} selected unit cases (${unitAttempt}), TypeScript (${staticAttempt}), one actual-App Chrome case (${browserAttempt}), ${visual.images.length} inspected views in [visual-review.json](visual-review.json), local PWA \`${pwa.buildId}\` and Android/dev \`${android.buildId}\`. The built-PWA case is existing offline/download smoke; Booky behavior is covered by actual-App source Chrome with controlled native ports. Raw reports, original captures and preserved binaries are linked from [result.json](result.json), not copied into this directory. Earlier failed attempts remain historical.\n\n${entry.preservedInputs.length} protected inputs, including the canonical scene, live Booky model and art, remain exact. Starter inventory stays historical 29/13/0 plus three owner additions. Only PLANETKA-008 advances to IN_PROGRESS; no acceptance or release approval is implied.\n\nNext: ${nextAction}\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision],
  ...globalFiles.slice(2, 5).map(file => [file, note + originalDocs.get(file)]),
  [globalFiles[5], json(trace)], [globalFiles[6], projectTraceabilityCsv(trace, sourceRows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' });
cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(readmePath, readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, inspectedImages: visual.images.length, counts,
  criterionChanges: result.criterionChanges, firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
