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
const folder = 'docs/mobile/evidence/S15/booky-semantic-progress-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-progress';
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
    'tests/pwa/booky-progress.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
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
const entry = await read(folder + '/entry.json');
const changed = entry.changedInputsBefore.map(item => item.path), added = entry.newSourcePaths;
const required = [...changed, ...added];
// This actual-App fixture executes the native adapter. The web adapter is bound
// by its unit suite and both strict build source manifests, not by this graph.
const browserRequired = required.filter(file => file.startsWith('src/') && file !== 'src/platform/adapters/web/WebPlatformAdapter.ts');
const unitFiles = entry.unitFiles;
for (const file of ['src/host/HostPlatformServices.ts', 'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css',
  'src/host/planetMascot.ts', 'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts',
  'src/host/planetMascotRoutes.ts', 'src/platform/adapters/web/WebPlatformAdapter.ts']) assert.ok(changed.includes(file), 'Required progress source binding: ' + file);
assert.deepEqual(added, ['src/host/bookyTourProgress.ts']);
assert.equal(entry.expectedBrowserTests, 3);
const requireInputs = (inputs, files = required) => {
  for (const file of files) assert.ok(inputs.some(item => item.path === file), 'Missing source binding: ' + file);
};
cleanSource();
const prior = await read(entry.previous);
assert.equal(entry.stage, 'S15'); assert.equal(entry.checkpoint, '5f532ec9b54c62eb76b97537f9b2a8fb03e92250');
assert.equal(entry.previous, 'docs/mobile/evidence/S15/booky-offline-help-20260920/result.json');
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
  'src/assets/mascots/knizhulyk-green-v1.png']);
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
    : mode === 'browser' ? { passed: entry.expectedBrowserTests, failed: 0, skipped: 0, flaky: 0 } : null);
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
      reason: attempt === 'a1'
        ? 'The first integrated run passed 249 unit cases, TypeScript and all three actual-App browser cases on its recorded source. Independent review then identified a same-store remount authority gap after a failed save; the source and regression coverage were strengthened. Preserve these passing reports as pass:true; they are superseded by the selected final matching source, not reclassified as failures or harness errors.'
        : attempt === 'a2'
          ? 'The second integrated run passed 253 unit cases, TypeScript and all three actual-App browser cases with source manifest 58094207cdfcff2380da6e3af1a30274f48485bbc4429b2e1be31ea036104bcc. Further lifecycle review identified retained write authority when the same persistence object deactivated and activated again; the final source adds fresh activation authority and a raw-write lifetime fence with regression coverage. Preserve these reports as successful pass:true evidence superseded by the final lifecycle fix, not as failures or harness errors.'
          : attempt === 'a3'
            ? 'The third integrated run passed 255 unit cases, TypeScript and all three actual-App browser cases with source manifest 5472b1ffd710072b32673374c502a013512ec82db5713d11e893a70d7d55d6f9. A subsequent targeted reproduction found that an old raw write could succeed after a fresh-read timeout on the same persistence object, then an equal-value toggle could take the confirmed-intent shortcut and remove the read-recovery UI. Preserve the passing a3 reports as pass:true; the final source and regression strengthen read-recovery authority and supersede this run without reclassifying it as a failure.'
        : 'Earlier attempt retained unchanged. Only the selected final source-bound attempt supports current validation.' });
  }
}
// Hash the historical attachments as they stand; do not compare their old
// source bindings to the current source or reinterpret a failed run as green.
for (const attempt of earlierAttempts.filter(item => item.mode === 'browser' && item.rawReport)) {
  const report = await read(attempt.rawReport.path), historical = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      historical.push(...(result.attachments ?? []).filter(item => item.name === 'booky-progress-source-evidence' && item.path));
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  attempt.browserAttachments = await Promise.all(historical.map(item => ref(item.path)));
}

const browser = await read(folder + '/browser-' + browserAttempt + '/playwright.json'), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [entry.expectedBrowserTests, 0, 0, 0]);
assert.deepEqual(browser.errors, []);
const visit = suite => {
  for (const spec of suite.specs ?? []) {
    specs.push(spec);
    for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []);
  }
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, entry.expectedBrowserTests);
for (const spec of specs) assert.equal(path.basename(spec.file.replaceAll('\\', '/')), 'booky-progress.spec.mjs');
const copies = attachments.filter(item => item.name === 'booky-progress-source-evidence' && item.path);
assert.equal(copies.length, entry.expectedBrowserTests);
const originals = [];
for (const child of await fs.readdir(artifacts + '/browser-' + browserAttempt, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'booky-progress.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, entry.expectedBrowserTests); originals.sort();
const actualAppCaptures = [], browserAttachments = [], apps = [], images = [], validatedBehavior = {};
const manifestFiles = (await read(sourceManifest.path)).files;
const scenarioContracts = {
  'legacy-progress': {
    claims: ['v1ColdReadDoesNotWrite', 'v1DoesNotInferAcknowledgements', 'explicitNextAcknowledgesOnlyCurrentStep',
      'versionedSemanticProgressPersisted', 'hidePreservesResumeAndProgress', 'coldRestoreStaysClosed',
      'explicitResumeRestoresSemanticStep', 'localeAndNarrowViewRetainProgress', 'sameCanonicalSceneWithinEachLoad',
      'noAutomaticNavigation', 'noReadingCompletionClaim', 'noAppearanceWrites'],
    observations: ['coldV1Closed', 'onlyAcknowledgedSearch', 'hiddenKeepsProgress', 'reloadClosed', 'resumedEn320'],
    narrow: 'resumedEn320', image: 'booky-progress-resumed-en-320.png',
  },
  'future-reset': {
    claims: ['futureRecordPreservedUntilConfirmation', 'cancelledResetDoesNotWrite', 'explicitGlobalResetClearsUnsupportedRecord',
      'resetPreservesVisibilityAndPanel', 'normalProgressWritableAfterConfirmedReset', 'sameCanonicalSceneWithinLoad',
      'noAutomaticNavigation', 'noAppearanceWrites'],
    observations: ['futureUnchangedAfterCancel', 'futureResetConfirmationRu320', 'confirmedReset', 'newProgressAfterReset'],
    narrow: 'futureResetConfirmationRu320', image: 'booky-progress-future-reset-ru-320.png',
  },
  'delayed-future-read': {
    claims: ['delayedNativeReadObserved', 'pendingReadDoesNotAuthorizeWrites', 'lateUnsupportedReadPreservesLatestLocalToggle',
      'ordinaryProgressCannotOverwriteFuture', 'noImplicitReset', 'sameCanonicalSceneWithinLoad', 'noAutomaticNavigation', 'noAppearanceWrites'],
    observations: ['localToggleBeforeRead', 'delayedReadProtectedEn320', 'localProgressCannotOverwriteFuture'],
    narrow: 'delayedReadProtectedEn320', image: 'booky-progress-delayed-future-en-320.png',
  },
};
for (const original of originals) {
  const capture = await ref(original), app = await read(original);
  const matches = copies.filter(item => normalized(item.path).startsWith(normalized(path.dirname(original)) + '/attachments/'));
  assert.equal(matches.length, 1);
  const attachment = await ref(matches[0].path);
  assert.ok((await fs.readFile(original)).equals(await fs.readFile(attachment.path)));
  actualAppCaptures.push(capture); browserAttachments.push(attachment); apps.push(app);
  for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true, key);
  const contract = scenarioContracts[app.scenario]; assert.ok(contract, 'Unknown browser scenario');
  for (const key of contract.claims) { assert.equal(app[key], true, key); validatedBehavior[key] = true; }
  noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
    'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
  for (const key of ['errors', 'externalRequests', 'missingResources', 'customizationWrites', 'unexpectedPreferenceWrites', 'controlledFailures']) assert.deepEqual(app[key], []);
  await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs, browserRequired);
  for (const item of app.sourceInputs.filter(item => browserRequired.includes(item.path))) {
    assert.ok(manifestFiles.some(source => source.path === item.path && source.sha256 === item.sha256));
  }
  for (const name of contract.observations) assert.ok(app.observations?.[name] && typeof app.observations[name] === 'object', name);
  const narrow = app.observations[contract.narrow].layout;
  assert.equal(narrow.width, 320); assert.equal(narrow.overflow, false);
  assert.equal(narrow.panelOverlapsPet, false); assert.equal(narrow.panelOverlapsAvatar, false);
  assert.ok(Number.isSafeInteger(narrow.stableSamples) && narrow.stableSamples >= 2);
  assert.deepEqual(narrow.languageButtons.map(button => button.label).sort(), ['EN', 'RU']);
  for (const button of narrow.languageButtons) {
    assert.equal(button.reachable, true); assert.equal(button.overlapsPet, false); assert.equal(button.overlapsPanel, false);
    assert.ok(button.width > 0 && button.height > 0 && button.left >= -.5 && button.top >= -.5
      && button.right <= narrow.width + .5 && button.bottom <= narrow.height + .5);
  }
  assert.equal(app.fallbackArtwork.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
  assert.equal(app.fallbackArtwork.path, 'src/assets/mascots/knizhulyk-green-v1.png');
  assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.fallbackArtwork.bundledPath && item.sha256 === app.fallbackArtwork.sha256));
  assert.equal(app.screenshots.length, 1); assert.equal(app.screenshots[0].filename, contract.image);
  images.push(...app.screenshots.map(item => {
    assert.match(item.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(item.framing?.trim());
    return { path: path.join(path.dirname(original), item.filename), sha256: item.sha256 };
  }));
  assert.equal(typeof app.initialBookyPreferenceRaw, 'string');
  assert.equal(typeof app.finalBookyPreferenceRaw, 'string');
  assert.deepEqual(JSON.parse(app.finalBookyPreferenceRaw), app.finalBookyPreference);
  if (app.scenario === 'delayed-future-read') {
    assert.deepEqual(app.bookyWrites, []); assert.equal(app.finalBookyPreferenceRaw, app.initialBookyPreferenceRaw);
    assert.equal(app.observations.delayedReadProtectedEn320.storedRaw, app.initialBookyPreferenceRaw);
    assert.equal(app.observations.delayedReadProtectedEn320.writes, 0);
    assert.equal(app.finalBookyPreference.schemaVersion, 91);
  } else {
    assert.ok(app.bookyWrites.length > 0);
    assert.deepEqual(app.finalBookyPreference, { schemaVersion: 2, audience: 'adult', visible: true,
      resume: { route: 'overview', routeVersion: 1, stepId: 'country' },
      progress: [{ route: 'overview', routeVersion: 1, acknowledgedStepIds: ['search'] }] });
    if (app.scenario === 'future-reset') {
      assert.equal(app.observations.futureResetConfirmationRu320.storedRaw, app.initialBookyPreferenceRaw);
      assert.equal(app.observations.futureResetConfirmationRu320.writes, 0);
      assert.deepEqual(JSON.parse(app.bookyWrites[0].value), { schemaVersion: 2, audience: 'adult', visible: true, resume: null, progress: [] });
    } else assert.equal(JSON.parse(app.initialBookyPreferenceRaw).schemaVersion, 1);
  }
}
assert.deepEqual(apps.map(app => app.scenario).sort(), Object.keys(scenarioContracts).sort());
validatedBehavior.languageControlsUncoveredAt320px = true;
validatedBehavior.stableCardAndAvatarDoNotOverlapAt320px = true;
const app = apps[0]; // Shared original fallback art, checked independently above.
await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
const captureRefs = refs => refs.map(item => ({ path: normalized(item.path), sha256: item.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(captureRefs(visual.actualAppCaptures), captureRefs(actualAppCaptures));
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

// Prepare the complete scoped checkpoint after all evidence passed. Authoring
// this helper alone does not write state, imply acceptance or create artifacts.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md',
  'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/REQUIREMENTS_TRACEABILITY.json', 'docs/mobile/REQUIREMENTS_TRACEABILITY.csv'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S15');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const beforeStatuses = statuses();
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 });
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance');
assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance'); assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03');
assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s15BookyOfflineHelp.path, entry.previous); await verifyRef(state.verificationCache.s15BookyOfflineHelp);
assert.equal(state.verificationCache.s15BookySemanticProgress, undefined);
for (const id of ['S15.PLANETKA-001', 'S15.PLANETKA-002', 'S15.PLANETKA-005', 'S15.PLANETKA-008']) assert.equal(stage.criteria.find(item => item.id === id).status, 'IN_PROGRESS');
const progressCriterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-008');
const trace = JSON.parse(originalDocs.get(globalFiles[5])), priorTrace = structuredClone(trace);
const progressRequirement = trace.requirements.find(item => item.id === 'PLANETKA-008'); assert.equal(progressRequirement.status, 'IN_PROGRESS');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s15-booky-progress-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D154:/gmu)].length, 1); assert.equal(/^- D155:/mu.test(decisions), false);
for (const file of globalFiles.slice(2, 5)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue S15 with a draft and review-aware bilingual dialogue registry for existing adult navigation and support: record provenance, version and review status; fail closed for future factual or child lines. Then prepare guarded canonical literary journey definitions. Do not enable child scenarios or claim reviewed text. Keep versioned adult progress, explicit resume/reset, future-record protection, offline/error recovery and canonical scene ownership intact. Full literary/educational journeys, child scenarios, reviewed dialogue/audio, screen-reader, installed-device/performance, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.';
const limitations = [
  'The saved records acknowledge steps of two existing adult navigation routes. They do not record reading, learning outcomes, literary journey completion, permissions or child progress.',
  'V1 migration retains a semantic cursor but infers no acknowledgements. Current route version 1 is explicit; migration across hypothetical future route revisions is not accepted by these current-version cases.',
  'Future or otherwise unsupported data stays protected until the user explicitly confirms a global reset. Local interaction while storage is unread or unsupported remains session-only; no successful persistence is inferred from UI progress.',
  'Authority checks protect the local preference-store lifecycle and require a fresh read after remount. They are not cross-process compare-and-swap: an already-started unabortable native write cannot be cancelled against an unseen concurrent external storage change.',
  'Actual-App Chrome executes native adapters with a controlled preference map and delayed reads. This is source behavior evidence, not installed-device, screen-reader, battery or performance acceptance.',
  'Strict PWA and Android manifests bind the changed source and original artwork. The built-PWA case remains the existing offline/download smoke rather than all progress/reset browser cases against distributed bundles.',
  'All former Planetka functions remain Booky scope. Full literary and educational journeys, child profiles, reviewed dialogue/audio, comprehensive journey migration and release gates remain pending.',
  'Original model, renderer, artwork and canonical scene inputs remain exact. RU/EN progress labels describe interface acknowledgements only; visual inspection is scoped layout evidence, not human editorial or formal art approval.',
  'Earlier attempts remain unchanged and are excluded from current acceptance unless selected as the final matching source-bound run. The prior starter inventory remains historical 29/13/0 plus three owner additions.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_SEMANTIC_PROGRESS_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), checkpointHelper: await ref(fileURLToPath(import.meta.url)),
  ownerClarification: entry.ownerClarification, attempts: { ...attempts, pwa: pwaAttempt, android: androidAttempt },
  earlierAttempts, runs, sourceManifest, unitCount, unitFiles, browserCases: entry.expectedBrowserTests,
  actualAppCaptures, browserAttachments, attachmentBytesMatchOriginal: true, validatedBehavior,
  visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  protectedInputCount: entry.preservedInputs.length, preservedInputsVerified: true,
  gitIdentityDifferences: [...gitIdentityDifferences.values()], changedSourcePaths: changed, newSourcePaths: added,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryHistorical: true, inventoryAuditRerun: false,
  inventoryUnchangedInputsVerified: true, inventoryChangedInputs,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId,
  apk: android.apk, buildAudits, copyVerification: await ref(copyPath), pwaBrowserReport: await ref(folder + '/pwa-' + pwaAttempt + '/playwright.json'),
  priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD155Recorded: true, criteriaUpdated: ['S15.PLANETKA-008'], criterionChanges: [], requirementChanges: [],
  stageChanges: [], allStageAndCriterionStatusesUnchanged: true, firstUnresolved: 'S03.acceptance',
  parallelSafeEntry: entry.parallelEntry, limitations, nextAction,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true,
  preferenceSchemaVersion: 2, knownNavigationRouteVersions: { overview: 1, 'country-to-book': 1 },
  migrationInfersAcknowledgements: false, progressPreservedWhenHidden: true, unsupportedWritesRequireExplicitReset: true,
  automaticResumeNavigation: false, readingCompletionClaimed: false,
  artChanged: false, globeSceneChanged: false, installedNativeDevice: false, builtPwaBookyProgressExecution: false,
  progressCopyStatus: 'draft', artAccepted: false, childProfileCreated: false, childAccessGranted: false, childApproved: false,
  rightsApproval: false, reviewedDialogueAccepted: false, narrationEnabled: false, ageAdaptiveJourneysEnabled: false,
  literaryJourneyPersistence: false, childJourneyPersistence: false, fullJourneyMigrationAccepted: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path,
  ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
const scopedNote = ' Adult navigation progress now uses schema v2 and versioned semantic acknowledgements for the two existing routes. Strict v1 migration adds no inferred steps; hide keeps progress and resume; cold restore stays closed; only confirmed reset can replace unsupported data. ' + unitCount + ' focused cases, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases and ' + visual.images.length + ' inspected views bind this source, with local PWA/Android preservation. This is not reading or full literary/child journey progress and does not close PLANETKA-008.';
progressCriterion.commit = sourceCommit; progressCriterion.lastValidatedAt = recordedAt;
progressCriterion.notes += scopedNote; push(progressCriterion.evidence, resultPath);
progressRequirement.commit = sourceCommit; progressRequirement.notes += scopedNote;
for (const file of required) push(progressRequirement.implementationFiles, file);
for (const file of [...unitFiles, 'tests/pwa/booky-progress.spec.mjs']) push(progressRequirement.tests, file);
push(progressRequirement.evidence, resultPath);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, 'node ' + folder + '/check.mjs ' + mode + ' ' + attempt);
for (const command of ['node ' + folder + '/run-pwa.mjs ' + sourceCommit, 'pwsh -File ' + folder + '/build-android.ps1 ' + sourceCommit, 'node ' + folder + '/preserve-android.mjs ' + sourceCommit]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 adult Booky semantic progress: schema v2, explicit step acknowledgement, hide/reload/resume, confirmed reset and future-record protection. ' + unitCount + ' tests, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases and ' + visual.images.length + ' inspected views bind preserved local PWA/Android. PLANETKA-008 remains IN_PROGRESS; literary/child/journey/review/device/release gates stay open.');
state.verificationCache.s15BookySemanticProgress = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
assert.deepEqual(trace.requirements.filter(item => item.id !== 'PLANETKA-008'), priorTrace.requirements.filter(item => item.id !== 'PLANETKA-008'));
assert.deepEqual(trace.requirements.map(item => [item.id, item.status]), priorTrace.requirements.map(item => [item.id, item.status]));
const sourceRows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originalDocs.get(globalFiles[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(priorTrace, sourceRows));
const decision = '\n- D155: Source ' + sourceCommit + ' introduces adult schema-v2 semantic navigation acknowledgements for the two existing version-1 routes. V1 cursors do not infer completed steps; hide preserves progress; restore remains closed; deliberate resume rechecks current prerequisites; only a confirmed global reset can overwrite unsupported future storage. Pending reads cannot authorize ordinary writes. ' + unitCount + ' focused tests, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases and ' + visual.images.length + ' inspected views bind local PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + '. Built-PWA coverage remains existing offline/download smoke. ' + entry.preservedInputs.length + ' protected scene/model/art/runtime inputs remain unchanged. PLANETKA-008 remains IN_PROGRESS and all stage/criterion statuses remain unchanged; S03.acceptance stays first unresolved. No reading, literary/child journey, reviewed-dialogue, device, iOS or release acceptance is claimed. Evidence: evidence/S15/booky-semantic-progress-20260920/result.json.\n';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ': adult Booky preserves explicitly acknowledged navigation steps in schema v2. V1 migration infers no progress; hiding keeps progress and cursor; restore stays closed; future data needs confirmed reset before replacement.\n' + unitCount + ' focused tests, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases, ' + visual.images.length + ' inspected views and local PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + ' bind this source. Built-PWA coverage remains offline/download smoke; ' + entry.preservedInputs.length + ' protected inputs stay exact.\nPLANETKA-008 remains IN_PROGRESS. Stage/criterion statuses are unchanged: 3 complete, 12 in progress, 26 unstarted; first unresolved S03.acceptance; releaseReady:false. All former Planetka functions remain Booky scope.\nEvidence: evidence/S15/booky-semantic-progress-20260920/result.json.\n' + nextAction + '\n<!-- s15-booky-progress-20260920:end -->\n\n';
const readme = '# S15 adult Booky semantic navigation progress\n\nSource: ' + sourceCommit + '. Scoped local validation only; S15 and PLANETKA-008 remain IN_PROGRESS. S03.acceptance stays first unresolved.\n\nSchema v2 stores only explicitly acknowledged semantic steps of the two existing adult navigation routes. Strict v1 migration adds no acknowledgements; hiding retains cursor and progress; cold restore stays closed; resume remains deliberate. Unsupported saved data is protected until a confirmed global reset. These records do not describe reading or full literary/child journey completion.\n\nEvidence: ' + unitCount + ' focused tests (' + unitAttempt + '), TypeScript (' + staticAttempt + '), ' + entry.expectedBrowserTests + ' actual-App Chrome cases (' + browserAttempt + '), ' + visual.images.length + ' inspected views in [visual-review.json](visual-review.json), local PWA ' + pwa.buildId + ' and Android/dev ' + android.buildId + '. Native preferences and delayed reads are controlled in the source fixture; built-PWA coverage is existing offline/download smoke. Earlier attempts remain preserved in [result.json](result.json).\n\n' + entry.preservedInputs.length + ' protected inputs, including canonical globe, live Booky model/renderer, original art and existing offline recovery, remain exact. Starter inventory remains historical 29/13/0 plus three owner additions. No stage, child, dialogue, accessibility, installed-device or release acceptance is implied.\n\nNext: ' + nextAction + '\n';
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision],
  ...globalFiles.slice(2, 5).map(file => [file, note + originalDocs.get(file)]),
  [globalFiles[5], json(trace)], [globalFiles[6], projectTraceabilityCsv(trace, sourceRows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' });
cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(readmePath, readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, browserCases: entry.expectedBrowserTests, inspectedImages: visual.images.length, counts,
  criterionChanges: [], firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
