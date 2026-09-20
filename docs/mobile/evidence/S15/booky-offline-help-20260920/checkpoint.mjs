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
const folder = 'docs/mobile/evidence/S15/booky-offline-help-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-offline';
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
    'tests/pwa/booky-support.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
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
const required = [...changed, ...added], browserRequired = required.filter(file => file.startsWith('src/'));
const unitFiles = entry.unitFiles;
for (const file of ['src/App.tsx', 'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css',
  'src/host/planetMascot.ts', 'src/loading/bookArchiveRuntime.ts', 'src/loading/DeferredHomepageArchives.tsx',
  'scripts/mobile/pwa-artifact.mjs']) assert.ok(changed.includes(file), 'Required recovery source binding: ' + file);
assert.deepEqual(added, ['src/host/bookySupport.ts']);
assert.ok(Number.isSafeInteger(entry.expectedBrowserTests) && entry.expectedBrowserTests >= 3);
const requireInputs = (inputs, files = required) => {
  for (const file of files) assert.ok(inputs.some(item => item.path === file), 'Missing source binding: ' + file);
};
cleanSource();
const prior = await read(entry.previous);
assert.equal(entry.stage, 'S15'); assert.equal(entry.checkpoint, '96073450baa71e5c364d622509a156624b2c767a');
assert.equal(entry.previous, 'docs/mobile/evidence/S15/booky-resume-preference-20260920/result.json');
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
      reason: mode === 'browser' && attempt === 'a1'
        ? 'Actual-App source Chrome preserved one passing network/lifecycle case and one failing real book-chunk recovery case. Reusing the failed primary module URL did not issue a new request. This product failure prompted the explicit bounded retry facade; the original report and captures remain unchanged.'
        : mode === 'browser' && attempt === 'a2'
          ? 'Actual-App source Chrome preserved four passing cases and one real 320px UI failure in collection-component recovery. The Booky card header intercepted pointer events on the visible EN language button, so locale switching timed out. The product fix reserves the native header/language area in the available card height; the original failed report and all captures remain unchanged.'
        : mode === 'browser' && attempt === 'a3'
          ? 'All five browser cases passed on this historical source, but inspection of the country-error screenshot found transient card/avatar overlap. Visual QA superseded this passing run; the source and fixture were refined to wait for fonts and two stable non-overlapping layout samples. Keep pass:true and the original report/captures; only the later final run supports current validation.'
        : 'Earlier attempt retained unchanged. Only the explicitly selected final source-bound attempt counts as current validation.' });
  }
}
assert.ok(earlierAttempts.some(item => item.mode === 'browser' && item.attempt === 'a1' && item.pass === false), 'Preserve failed actual-App browser a1');
assert.ok(earlierAttempts.some(item => item.mode === 'browser' && item.attempt === 'a2' && item.pass === false
  && item.tests?.passed === 4 && item.tests?.failed === 1), 'Preserve failed 320px language-control browser a2');
assert.ok(earlierAttempts.some(item => item.mode === 'browser' && item.attempt === 'a3' && item.pass === true
  && item.tests?.passed === 5 && item.tests?.failed === 0), 'Preserve passing browser a3 superseded by visual QA');
// Hash the historical attachments as they stand; do not compare their old
// source bindings to the current source or reinterpret a failed run as green.
for (const attempt of earlierAttempts.filter(item => item.mode === 'browser' && item.rawReport)) {
  const report = await read(attempt.rawReport.path), historical = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      historical.push(...(result.attachments ?? []).filter(item => item.name === 'booky-support-source-evidence' && item.path));
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
for (const spec of specs) assert.equal(path.basename(spec.file.replaceAll('\\', '/')), 'booky-support.spec.mjs');
const copies = attachments.filter(item => item.name === 'booky-support-source-evidence' && item.path);
assert.equal(copies.length, entry.expectedBrowserTests);
const originals = [];
for (const child of await fs.readdir(artifacts + '/browser-' + browserAttempt, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'booky-support.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, entry.expectedBrowserTests); originals.sort();
const actualAppCaptures = [], browserAttachments = [], apps = [], images = [], validatedBehavior = {};
const manifestFiles = (await read(sourceManifest.path)).files;
const networkClaims = ['supportOnlyInsideExplicitOpenPanel', 'localeAndNarrowViewRetainTour',
  'offlineUnknownOnlineDoNotChangePreferences', 'hiddenAndCollapsedStayClosed',
  'backgroundClosesAndResumeDoesNotReopen', 'explicitHideIsOnlyBookyWrite',
  'canonicalSceneAndSelectionRetained', 'noAppearanceWrites', 'noEndpointReachabilityClaim'];
const errorClaims = ['realSplitChunkFailure', 'networkHintsCannotClearContentError',
  'explicitRetryLoadsCanonicalCollection', 'distinctBoundedRetryUrl', 'canonicalBookDependenciesShared',
  'noAutomaticRetry', 'sameCanonicalSceneWithinLoad',
  'noAutomaticNavigationDuringRecovery', 'narrowErrorFits', 'noAppearanceWrites'];
const persistentClaims = ['realPrimaryAndRetryChunkFailures', 'persistentFailureStaysHonest',
  'networkHintsCannotClearContentError', 'noAutomaticRetry', 'explicitReturnUsesCanonicalGlobe',
  'noSuccessfulCollectionClaim', 'sameCanonicalSceneWithinLoad', 'noAppearanceWrites'];
const countryClaims = ['realCountryCatalogFailure', 'errorRevealedBeforeGlobeMount', 'noInitialSceneRetentionClaim',
  'explicitRetryMountsCanonicalGlobe', 'distinctBoundedCountryRetryUrl', 'canonicalCountryDependenciesShared',
  'networkHintsCannotClearContentError', 'noAutomaticRetry', 'noAutomaticNavigationDuringRecovery', 'noAppearanceWrites'];
const componentClaims = ['realCollectionComponentFailure', 'explicitRetryLoadsCanonicalComponent',
  'distinctBoundedComponentRetryUrl', 'canonicalComponentDependenciesShared', 'loadedBookDataReusedWithoutRefetch',
  'networkHintsCannotClearContentError', 'noAutomaticRetry', 'sameCanonicalSceneWithinLoad',
  'noAutomaticNavigationDuringRecovery', 'noAppearanceWrites'];
for (const original of originals) {
  const capture = await ref(original), app = await read(original);
  const matches = copies.filter(item => normalized(item.path).startsWith(normalized(path.dirname(original)) + '/attachments/'));
  assert.equal(matches.length, 1);
  const attachment = await ref(matches[0].path);
  assert.ok((await fs.readFile(original)).equals(await fs.readFile(attachment.path)));
  actualAppCaptures.push(capture); browserAttachments.push(attachment); apps.push(app);
  for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true, key);
  const errorCase = app.realSplitChunkFailure === true, persistentCase = app.realPrimaryAndRetryChunkFailures === true;
  const networkCase = app.noEndpointReachabilityClaim === true;
  const countryCase = app.realCountryCatalogFailure === true, componentCase = app.realCollectionComponentFailure === true;
  assert.equal([errorCase, persistentCase, networkCase, countryCase, componentCase].filter(Boolean).length, 1);
  const claims = errorCase ? errorClaims : persistentCase ? persistentClaims : networkCase ? networkClaims
    : countryCase ? countryClaims : componentClaims;
  assert.ok(claims.length > 0);
  for (const key of claims) { assert.equal(app[key], true, key); validatedBehavior[key] = true; }
  noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
    'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
  for (const key of ['errors', 'externalRequests', 'missingResources', 'customizationWrites', 'unexpectedPreferenceWrites']) assert.deepEqual(app[key], []);
  await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs, browserRequired);
  for (const item of app.sourceInputs.filter(item => browserRequired.includes(item.path))) {
    assert.ok(manifestFiles.some(source => source.path === item.path && source.sha256 === item.sha256));
  }
  const observationKeys = errorCase ? ['failedRu', 'errorEn320', 'recovered']
    : persistentCase ? ['secondFailure', 'explicitReturn']
      : networkCase ? ['offlineRu', 'offlineEn320', 'unknown', 'onlineRemovesNetworkHint', 'resumedClosed']
        : countryCase ? ['beforeExplicitOpen', 'countryErrorEn320', 'canonicalGlobeAfterRetry']
          : ['componentErrorRu320', 'componentRecovered'];
  assert.ok(observationKeys.length > 0);
  for (const name of observationKeys) assert.ok(app.observations?.[name] && typeof app.observations[name] === 'object', name);
  const narrowObservation = errorCase ? 'errorEn320' : persistentCase ? 'secondFailure'
    : networkCase ? 'offlineEn320' : countryCase ? 'countryErrorEn320' : 'componentErrorRu320';
  const narrow = app.observations[narrowObservation].layout;
  assert.equal(narrow.width, 320); assert.equal(narrow.overflow, false);
  assert.equal(narrow.panelOverlapsPet, false); assert.equal(narrow.panelOverlapsAvatar, false);
  assert.ok(Number.isSafeInteger(narrow.stableSamples) && narrow.stableSamples >= 2, 'Stable final non-overlapping layout');
  assert.deepEqual(narrow.languageButtons.map(button => button.label).sort(), ['EN', 'RU']);
  for (const button of narrow.languageButtons) {
    assert.equal(button.reachable, true); assert.equal(button.overlapsPet, false); assert.equal(button.overlapsPanel, false);
    assert.ok(button.width > 0 && button.height > 0 && button.left >= -.5 && button.top >= -.5
      && button.right <= narrow.width + .5 && button.bottom <= narrow.height + .5);
  }
  assert.equal(app.fallbackArtwork.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
  assert.equal(app.fallbackArtwork.path, 'src/assets/mascots/knizhulyk-green-v1.png');
  assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.fallbackArtwork.bundledPath && item.sha256 === app.fallbackArtwork.sha256));
  assert.ok(app.screenshots.length > 0); assert.equal(new Set(app.screenshots.map(item => item.filename)).size, app.screenshots.length);
  const expectedImage = errorCase ? 'booky-support-collection-error-en-320.png'
    : persistentCase ? 'booky-support-retry-failed-ru-320.png'
      : networkCase ? 'booky-support-offline-en-320.png'
        : countryCase ? 'booky-support-countries-error-en-320.png' : 'booky-support-component-error-ru-320.png';
  if (expectedImage) assert.ok(app.screenshots.some(item => item.filename === expectedImage));
  images.push(...app.screenshots.map(item => {
    assert.match(item.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(item.framing?.trim());
    return { path: path.join(path.dirname(original), item.filename), sha256: item.sha256 };
  }));
  if (errorCase) {
    assert.equal(app.controlledFailures.length, 1); assert.equal(app.controlledFailures[0].status, 503);
    assert.ok(app.bookRequests.length > 1);
    assert.ok(new Set(app.bookRequests).size > 1, 'Recovery must request a distinct build-known book facade');
    assert.deepEqual(app.bookyWrites, []);
  } else if (persistentCase) {
    assert.equal(app.controlledFailures.length, 2); assert.ok(app.controlledFailures.every(item => item.status === 503));
    assert.equal(app.bookRequests.length, 2); assert.equal(new Set(app.bookRequests).size, 2);
    assert.deepEqual(app.bookyWrites, []);
  } else if (networkCase) {
    assert.deepEqual(app.controlledFailures, []); assert.equal(app.bookyWrites.length, 1);
  } else if (countryCase) {
    assert.equal(app.actualGlobeInitiallyMounted, false);
    assert.equal(app.observations.beforeExplicitOpen.globe, null);
    assert.equal(app.observations.countryErrorEn320.globe, null);
    assert.ok(app.observations.canonicalGlobeAfterRetry.globe);
    assert.equal(app.controlledFailures.length, 1); assert.equal(app.controlledFailures[0].status, 503);
    assert.deepEqual(app.countryRequests, [app.primaryCountryChunk, app.retryCountryChunk]);
    assert.equal(new Set(app.countryRequests).size, 2);
    assert.deepEqual(app.bookyWrites, []);
  } else if (componentCase) {
    assert.equal(app.controlledFailures.length, 1); assert.equal(app.controlledFailures[0].status, 503);
    assert.deepEqual(app.componentRequests, [app.primaryComponentChunk, app.retryComponentChunk]);
    assert.equal(new Set(app.componentRequests).size, 2);
    assert.deepEqual(app.bookRequests, [app.primaryBookChunk]);
    assert.deepEqual(app.bookyWrites, []);
  }
}
assert.equal(apps.filter(app => app.realSplitChunkFailure === true).length, 1);
assert.equal(apps.filter(app => app.noEndpointReachabilityClaim === true).length, 1);
assert.equal(apps.filter(app => app.realPrimaryAndRetryChunkFailures === true).length, 1);
assert.equal(apps.filter(app => app.realCountryCatalogFailure === true).length, 1);
assert.equal(apps.filter(app => app.realCollectionComponentFailure === true).length, 1);
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

// Validate all evidence and prepare the checkpoint before any state writes.
// Merely authoring this helper does not create acceptance or update state.
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
assert.equal(state.verificationCache.s15BookyResumePreference.path, entry.previous); await verifyRef(state.verificationCache.s15BookyResumePreference);
assert.equal(state.verificationCache.s15BookyOfflineHelp, undefined);
for (const id of ['S15.PLANETKA-001', 'S15.PLANETKA-002', 'S15.PLANETKA-008']) assert.equal(stage.criteria.find(item => item.id === id).status, 'IN_PROGRESS');
const supportCriterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-005'); assert.equal(supportCriterion.status, 'OPEN');
expectedStatuses.find(item => item[0] === 'S15')[2].find(item => item[0] === 'S15.PLANETKA-005')[1] = 'IN_PROGRESS';
const trace = JSON.parse(originalDocs.get(globalFiles[5])), priorTrace = structuredClone(trace);
const supportRequirement = trace.requirements.find(item => item.id === 'PLANETKA-005'); assert.equal(supportRequirement.status, 'OPEN');
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s15-booky-offline-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D153:/gmu)].length, 1); assert.equal(/^- D154:/mu.test(decisions), false);
for (const file of globalFiles.slice(2, 5)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue S15 with versioned adult semantic progress for the two existing navigation routes: persist only explicitly acknowledged steps; migrate v1 to v2 strictly without inferring completed steps; preserve progress when Booky is hidden; provide explicit reset; and never overwrite an unsupported future record version. Keep restore closed and resume deliberate, without automatic navigation or restored permissions. Preserve offline/error recovery, the canonical scene and bounded split-module retry facades. This remains adult navigation progress only: full literary/educational journeys, child scenarios, reviewed dialogue/audio, full migration, screen-reader, installed-device/performance, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.';
const limitations = [
  'Adult guidance consumes existing connectivity and content-loading state. Online is a platform hint, not endpoint reachability or successful content loading; unknown remains unknown. No offline durability, access or entitlement is guaranteed.',
  'Recovery is explicit and context-fenced. A bounded alternate facade can recover a failed entry request; shared transitive dependency failure, every transport/cache failure and unlimited recovery are not established by these source-fixture cases.',
  'Actual-App source Chrome runs real canonical modules/CSS/globe with controlled native OS/preferences ports and selected HTTP 503 failures. It does not establish installed-device, screen-reader, battery or performance acceptance.',
  'PWA and Android strict build manifests bind the changed runtime and exact build-known retry entries. The built-PWA case remains the existing offline/download smoke, not a replay of all source-fixture chunk failures against distributed bundles.',
  'RU/EN adult support copy remains draft. Screenshot inspection is scoped layout evidence, not editorial, child or formal art approval.',
  'All former Planetka functionality remains Booky scope. Child profiles, reviewed dialogue/audio, educational/literary journeys, full progress and migration remain pending; this slice does not complete them.',
  'The original live Booky model/renderer/art and protected canonical scene inputs remain byte-exact. Unchanged geometry and adapter suites were not repeated.',
  'Original actual-App product failures remain preserved: browser a1 exposed the cached import rejection; browser a2 exposed a 320px card overlap that blocked EN language switching. Browser a3 passed all five cases but was superseded after visual inspection found transient card/avatar overlap; it remains pass:true. Final captures require two stable non-overlapping layout samples after fonts are ready. Starter inventory remains historical 29/13/0 plus three owner additions with explicit changed bindings.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_OFFLINE_HELP_SCOPED_VALIDATION', pass: true,
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
  decisionD154Recorded: true, criteriaUpdated: ['S15.PLANETKA-005'],
  criterionChanges: [{ id: 'S15.PLANETKA-005', before: 'OPEN', after: 'IN_PROGRESS' }],
  requirementChanges: [{ id: 'PLANETKA-005', before: 'OPEN', after: 'IN_PROGRESS' }],
  stageChanges: [], otherStageAndCriterionStatusesUnchanged: true, firstUnresolved: 'S03.acceptance',
  parallelSafeEntry: entry.parallelEntry, limitations, nextAction,
  actualApp: true, actualCss: true, actualGlobe: true, controlledNativePorts: true,
  controlledSourceEntryFailureCoverage: true, automaticNetworkRetry: false, automaticRecoveryNavigation: false,
  boundedBuildKnownRetryFacades: true, canonicalBookDependenciesShared: true,
  artChanged: false, globeSceneChanged: false, installedNativeDevice: false, builtPwaBookyFailureRecoveryExecution: false,
  supportCopyStatus: 'draft', artAccepted: false, childProfileCreated: false, childAccessGranted: false, childApproved: false,
  rightsApproval: false, reviewedDialogueAccepted: false, narrationEnabled: false, ageAdaptiveJourneysEnabled: false,
  literaryJourneyPersistence: false, childJourneyPersistence: false, fullJourneyMigrationAccepted: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path,
  ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
const scopedNote = ' Adult Booky now gives RU/EN offline, unknown, loading and recoverable-error guidance from actual host state, with explicit context-fenced recovery. Failed primary split-module entries use bounded build-known alternate facades while canonical dependencies stay shared. ' + unitCount + ' focused cases, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases and ' + visual.images.length + ' inspected views bind this source; local PWA/Android preserve the runtime. Original browser-a1 import failure and browser-a2 language-control overlap remain evidence; final narrow-view captures prove both locale controls are uncovered. This starts the adult offline/error foundation only; child, dialogue, literary journeys, accessibility/device and release gates remain open.';
supportCriterion.status = 'IN_PROGRESS'; supportCriterion.commit = sourceCommit; supportCriterion.lastValidatedAt = recordedAt;
supportCriterion.notes += scopedNote; push(supportCriterion.evidence, resultPath);
supportRequirement.status = 'IN_PROGRESS'; supportRequirement.commit = sourceCommit; supportRequirement.notes += scopedNote;
for (const file of required) push(supportRequirement.implementationFiles, file);
for (const file of [...unitFiles, 'tests/pwa/booky-support.spec.mjs']) push(supportRequirement.tests, file);
push(supportRequirement.evidence, resultPath);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, 'node ' + folder + '/check.mjs ' + mode + ' ' + attempt);
for (const command of ['node ' + folder + '/run-pwa.mjs ' + sourceCommit, 'pwsh -File ' + folder + '/build-android.ps1 ' + sourceCommit, 'node ' + folder + '/preserve-android.mjs ' + sourceCommit]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 adult Booky offline/error helper: ' + unitCount + ' focused cases, TypeScript, ' + entry.expectedBrowserTests + ' actual-App browser cases, ' + visual.images.length + ' inspected views and bound local PWA/Android artifacts. Preserve browser-a1 cached-import and browser-a2 language-control-overlap failures. PLANETKA-005 is IN_PROGRESS only; all child/literary/art/device/release gates stay open.');
state.verificationCache.s15BookyOfflineHelp = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
assert.deepEqual(trace.requirements.filter(item => item.id !== 'PLANETKA-005'), priorTrace.requirements.filter(item => item.id !== 'PLANETKA-005'));
const sourceRows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originalDocs.get(globalFiles[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(priorTrace, sourceRows));
const decision = '\n- D154: Source ' + sourceCommit + ' implements bounded adult RU/EN Booky offline/error support and explicit context-fenced recovery. Real source-fixture browser-a1 failure revealed cached primary module rejection; canonical book data, countries and collection component retain primary imports and gain bounded build-known retry facades. Exact PWA bootstrap entries include those reviewed facades. Browser-a2 then exposed a 320px card overlap blocking EN; the corrected card reserves the header/language area and final captures prove both locale controls remain directly reachable. ' + unitCount + ' focused unit cases, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases and ' + visual.images.length + ' inspected views bind source; local PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + ' preserve it. Built-PWA coverage is existing offline/download smoke, not all distributed chunk failures. ' + entry.preservedInputs.length + ' protected inputs remain unchanged. Only S15.PLANETKA-005 and global PLANETKA-005 advance OPEN to IN_PROGRESS; all other statuses stay unchanged, S03.acceptance remains first unresolved. RU/EN copy is draft; child, literary journeys, dialogue/audio, full migration, screen-reader, installed-device, iOS and release gates remain open. Evidence: evidence/S15/booky-offline-help-20260920/result.json.\n';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ': adult Booky explains offline/unknown/loading/error state and offers explicit recovery. Bounded canonical split-entry retries fix the real source-fixture error preserved in browser-a1; no automatic navigation or connectivity-based success claim.\n' + unitCount + ' selected tests, TypeScript, ' + entry.expectedBrowserTests + ' actual-App Chrome cases, ' + visual.images.length + ' inspected views and local PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + ' bind this source. Built-PWA coverage remains offline/download smoke; ' + entry.preservedInputs.length + ' protected inputs stay exact.\nOnly S15.PLANETKA-005/global005 become IN_PROGRESS. Stages remain 3 complete, 12 in progress, 26 unstarted; first unresolved S03.acceptance; releaseReady:false. All former Planetka functions remain Booky scope.\nEvidence: evidence/S15/booky-offline-help-20260920/result.json.\n' + nextAction + '\n<!-- s15-booky-offline-20260920:end -->\n\n';
const readme = '# S15 adult Booky offline and error help\n\nSource: ' + sourceCommit + '. Scoped local validation only; S15 remains IN_PROGRESS and S03.acceptance remains first unresolved.\n\nAdult RU/EN help reads existing connectivity and loading state. Explicit recovery is context-fenced; network hints cannot dismiss content failures, reopen hidden help or change saved preferences. Primary canonical imports and bounded build-known retry facades keep shared dependencies. All former Planetka functionality remains Booky scope.\n\nEvidence: ' + unitCount + ' focused unit cases (' + unitAttempt + '), TypeScript (' + staticAttempt + '), ' + entry.expectedBrowserTests + ' actual-App Chrome cases (' + browserAttempt + '), ' + visual.images.length + ' inspected views in [visual-review.json](visual-review.json), local PWA ' + pwa.buildId + ' and Android/dev ' + android.buildId + '. Real source-fixture HTTP failures exercise recovery; the built-PWA case is existing offline/download smoke. The original browser-a1 cached-import failure, browser-a2 language-control blockage and all later attempts remain preserved in [result.json](result.json). This does not claim exhaustive distributed chunk/cache recovery.\n\n' + entry.preservedInputs.length + ' protected inputs, including canonical scene, live Booky model/renderer and original art, remain exact. Starter inventory stays historical 29/13/0 plus three owner additions. Only PLANETKA-005 advances to IN_PROGRESS; copy stays draft and no acceptance or release approval is implied.\n\nNext: ' + nextAction + '\n';
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision],
  ...globalFiles.slice(2, 5).map(file => [file, note + originalDocs.get(file)]),
  [globalFiles[5], json(trace)], [globalFiles[6], projectTraceabilityCsv(trace, sourceRows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' });
cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(readmePath, readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, browserCases: entry.expectedBrowserTests, inspectedImages: visual.images.length, counts,
  criterionChanges: result.criterionChanges, firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
