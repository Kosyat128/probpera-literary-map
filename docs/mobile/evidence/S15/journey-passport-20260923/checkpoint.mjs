import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Preparation only until deliberately invoked after committing the source,
// selecting final matching checks, inspecting captures, and preserving builds.
// CLI: checkpoint.mjs SOURCE UNIT_ATTEMPT STATIC_ATTEMPT BROWSER_ATTEMPT
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/journey-passport-20260923';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-journey-passport';
const normal = file => path.resolve(file).replaceAll('\\', '/');
assert.equal(normal(await fs.realpath('.')), root);
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
async function verify(item) {
  assert.match(item.sha256, /^[a-f0-9]{64}$/u);
  const bytes = await fs.readFile(item.path); assert.equal(sha(bytes), item.sha256, item.path);
  if (item.bytes !== undefined) assert.equal(bytes.length, item.bytes, item.path);
  return bytes;
}
const verifiedJson = async item => JSON.parse(await verify(item));
const verifyInputs = async items => { for (const item of items) await verify(item); };
async function optionalRef(file) { try { return await ref(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const noApproval = (item, keys = ['stageAccepted', 'releaseReady']) => { for (const key of keys) assert.equal(item[key], false, key); };
const sourceRoots = ['src', 'scripts/mobile', 'tests/pwa', 'apps/mobile', 'data/book-canon-source-registry.json', 'index.html',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.native.config.ts', 'vite.pwa.config.ts', 'capacitor.config.json', 'native.html'];
const clean = () => { assert.equal(git(['rev-parse', 'HEAD']), sourceCommit); assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', ...sourceRoots]), ''); };
const entry = await read(folder + '/entry.json'), changed = entry.changedPaths, added = entry.newSourcePaths;
assert.equal(entry.stage, 'S15'); assert.equal(entry.expectedBrowserTests, 20); noApproval(entry); assert.equal(entry.childApproved, false); assert.equal(entry.expectedImages, 18);
assert.equal(entry.checkpoint, '3d84c2250c76ce1b96dea0e56d9877cc0d5e92b4');
assert.equal(changed.length, 4); assert.equal(added.length, 4);
assert.equal(entry.newImplementationFiles.length, 3); assert.equal(entry.unitFiles.length, 24);
const required = [...changed, ...added]; assert.equal(new Set(required).size, 8);
const runtimeRequired = required.filter(file => file.startsWith('src/') && !/\.(test|spec)\./u.test(file));
assert.equal(runtimeRequired.length, 6);
git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]); assert.notEqual(sourceCommit, entry.checkpoint); clean();
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),
  [...changed.map(file => 'M\t' + file), ...added.map(file => 'A\t' + file)].sort());
const sourceCommits = git(['rev-list', '--reverse', entry.checkpoint + '..' + sourceCommit]).split(/\r?\n/u).filter(Boolean);
const prior = await verifiedJson(entry.previousCheckpointResult), baseline = await verifiedJson(entry.priorSourceManifest);
assert.equal(entry.previousCheckpointResult.path, entry.previous); assert.equal(prior.pass, true); noApproval(prior);
assert.equal(prior.sourceCommit, '67838a7c59792ad3abe2abff63cf7be01e7460bb');
assert.equal(prior.productionJourneyCount, 0); assert.equal(prior.approvedProductionDialogueCount, 0);
assert.equal(prior.combinedDraftCount, 34); assert.equal(prior.unitCount, 639); assert.equal(prior.unitRerun, true);
assert.deepEqual(prior.sourceManifest, entry.priorSourceManifest); assert.equal(baseline.files.length, 1628);
assert.equal(entry.priorSourceManifest.fileCount, 1628);
const baselineMap = new Map(baseline.files.map(item => [item.path, item.sha256])); assert.equal(baselineMap.size, 1628);
for (const file of changed) assert.ok(baselineMap.has(file));
for (const file of added) assert.equal(baselineMap.has(file), false);
const protectedFiles = baseline.files.filter(item => !changed.includes(item.path)); assert.equal(protectedFiles.length, 1624);
await verifyInputs(protectedFiles); await verifyInputs(entry.checkpointFiles);

const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {}, earlierAttempts = [];
let sourceManifest, manifestFiles;
for (const [mode, attempt] of Object.entries(attempts)) {
  const base = `${folder}/${mode}-${attempt}`, report = await read(base + '/result.json');
  assert.equal(report.pass, true); assert.equal(report.mode, mode); assert.equal(report.attempt, attempt);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  assert.equal(report.runtimeWiringImplemented, true); assert.equal(report.runtimeUnchanged, false);
  noApproval(report, ['stageAccepted', 'releaseReady', 'ageAdaptiveJourneysAccepted', 'reviewedDialogueAccepted', 'childApproved']);
  const manifest = await verifiedJson(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, 1632); assert.equal(report.sourceManifest.fileCount, 1632);
  assert.deepEqual(manifest.files.map(item => item.path).sort(), [...baselineMap.keys(), ...added].sort());
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else { sourceManifest = report.sourceManifest; manifestFiles = manifest.files; await verifyInputs(manifestFiles); }
  await verifyInputs(report.checkInputs);
  const execution = await read(base + '/execution.json'); assert.equal(execution.exitCode, 0);
  await verifyInputs([execution.stdout, execution.stderr]);
  const raw = mode === 'unit' ? 'vitest.json' : mode === 'browser' ? 'playwright.json' : null;
  runs[mode] = { ...await ref(base + '/result.json'), tests: report.tests, execution: await ref(base + '/execution.json'),
    rawReport: raw ? await ref(base + '/' + raw) : null, checkInputs: report.checkInputs };
  for (let n = 1; n < Number(attempt.slice(1)); n++) {
    const oldBase = `${folder}/${mode}-a${n}`, result = await optionalRef(oldBase + '/result.json'); if (!result) continue;
    const old = await read(result.path); await verify(old.sourceManifest); if (old.sourceManifestAfter) await verify(old.sourceManifestAfter);
    const execution = await read(oldBase + '/execution.json'); await verifyInputs([execution.stdout, execution.stderr]);
    const checkInputs = [];
    for (const input of old.checkInputs) {
      const current = await ref(input.path);
      if (current.sha256 === input.sha256) { checkInputs.push(input); continue; }
      // The first fixture/type failures used the original scope. Its immutable
      // copy retains that hash; the revised entry belongs only to later runs.
      assert.equal(input.path, folder + '/entry.json');
      const preservedAs = await ref(`${folder}/entry-a${n}.json`);
      assert.equal(preservedAs.sha256, input.sha256); checkInputs.push({ ...input, preservedAs });
    }
    const rawReport = raw ? await optionalRef(oldBase + '/' + raw) : null, attachments = [];
    if (mode === 'browser' && rawReport) {
      const original = await read(rawReport.path);
      for (const attachment of browserRecords(original).attachments.filter(item => item.path)) attachments.push(await ref(attachment.path));
    }
    earlierAttempts.push({ ...result, mode, attempt: 'a' + n, pass: old.pass, tests: old.tests,
      sourceManifest: old.sourceManifest, execution: await ref(oldBase + '/execution.json'), rawReport, attachments,
      checkInputs, reportError: old.reportError, executionExitCode: execution.exitCode,
      reason: 'Original attempt and raw reports retained unchanged; only selected matching final checks support this checkpoint.' });
  }
}
const sourceMap = new Map(manifestFiles.map(item => [item.path, item.sha256]));
for (const item of protectedFiles) assert.equal(sourceMap.get(item.path), item.sha256, item.path);
const gitIdentityDifferences = [];
// Only changed/new Git blobs are read. Protected inputs retain their exact
// previously verified manifest hashes; do not launch 1,632 git-show processes.
for (const file of required) {
  const blob = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', sourceCommit + ':' + file], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const checkedOut = await fs.readFile(file); assert.equal(sha(checkedOut), sourceMap.get(file));
  if (!blob.equals(checkedOut)) {
    assert.ok(Buffer.from(blob.toString('utf8')).equals(blob)); assert.ok(Buffer.from(checkedOut.toString('utf8')).equals(checkedOut));
    assert.equal(blob.toString('utf8').replaceAll('\r\n', '\n'), checkedOut.toString('utf8').replaceAll('\r\n', '\n'), file);
    gitIdentityDifferences.push({ path: file, gitBlobSha256: sha(blob), checkedOutSha256: sha(checkedOut), lineEndingOnly: true });
  }
}
const units = await verifiedJson(runs.unit.rawReport), cases = units.testResults.flatMap(item => item.assertionResults);
assert.deepEqual(units.testResults.map(item => normal(item.name)).sort(), entry.unitFiles.map(normal).sort());
assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.deepEqual([units.numPassedTests, units.numFailedTests, units.numPendingTests], [cases.length, 0, 0]);
assert.deepEqual(runs.unit.tests, { passed: cases.length, failed: 0, skipped: 0 }); assert.equal(runs.static.tests, null);
assert.ok(cases.some(item => (item.fullName ?? item.title).includes('ships no production journey, dialogue, review receipt or availability seed')));
const registryCases = units.testResults.find(item => normal(item.name) === normal('src/host/bookyJourneyMigrationRegistry.test.ts')).assertionResults;
assert.ok(registryCases.some(item => (item.fullName ?? item.title).includes('keeps production inventory stable, deeply frozen and empty')));
const productionInventorySources = [];
for (const file of ['src/host/bookyJourneyContent.ts', 'src/host/bookyJourneyMigrationContent.ts']) {
  const reference = await ref(file);
  assert.equal(reference.sha256, sourceMap.get(file)); assert.equal(reference.sha256, baselineMap.get(file));
  productionInventorySources.push(reference);
}
for (const [file, title] of [
  ['src/host/bookyJourneyActivity.test.ts', 'honors factual single-author attribution instead of the archive routing owner'],
  ['src/host/bookyJourneyProgress.test.ts', 'round-trips only task id/version/fingerprint without any selected choice or answer key'],
  ['src/host/bookyJourneyPrerequisites.test.ts', 'denies old activity completion when canonical authorship changes under the same reviewed prompt and routing key'],
  ['src/host/bookyJourneyMigration.test.ts', 'rejects changed factual author, authorship provenance, question id or version despite fresh mapping review'],
  ['src/host/bookyJourneyPassport.test.ts', 'credits only the acknowledged navigation prefix, never the active cursor or a merely admitted route'],
  ['src/host/bookyJourneyPassport.test.ts', 'requires both freshly admitted locale definitions and displays only the current locale title'],
  ['src/host/bookyJourneyPassport.test.ts', 'recomputes dependent contributions after deletion or prerequisite review revocation'],
  ['src/host/bookyJourneyPassport.test.ts', 'never credits activity target/options as navigation, and rejects saved progress after derived authorship changes'],
]) {
  const result = units.testResults.find(item => normal(item.name) === normal(file)); assert.ok(result);
  assert.ok(result.assertionResults.some(item => (item.fullName ?? item.title).includes(title) && item.status === 'passed'));
}

function browserRecords(report) {
  const specs = [], attachments = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      specs.push(spec);
      for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []);
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return { specs, attachments };
}
const browser = await verifiedJson(runs.browser.rawReport), { specs, attachments } = browserRecords(browser);
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [entry.expectedBrowserTests, 0, 0, 0]);
assert.deepEqual(runs.browser.tests, { passed: entry.expectedBrowserTests, failed: 0, skipped: 0, flaky: 0 }); assert.deepEqual(browser.errors, []);
assert.equal(specs.length, entry.expectedBrowserTests);
assert.deepEqual(specs.map(item => path.basename(item.file.replaceAll('\\', '/'))).sort(),
  [...Array(18).fill('booky-journey.spec.mjs'), ...Array(2).fill('booky-reader-policy.spec.mjs')]);
for (const spec of specs) { assert.equal(spec.ok, true); for (const test of spec.tests) for (const result of test.results) assert.equal(result.status, 'passed'); }
const reportNames = ['booky-journey', 'booky-reader-policy'], captures = [];
for (const dir of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(dir.isSymbolicLink(), false); if (!dir.isDirectory()) continue;
  for (const name of reportNames) {
    const original = await optionalRef(`${artifacts}/browser-${browserAttempt}/${dir.name}/${name}.json`);
    if (original) captures.push({ original, name });
  }
}
assert.equal(captures.length, entry.expectedBrowserTests);
const contracts = {
  'explicit-journey': ['actualCountryWriterWork', 'exactWorkVisible', 'acknowledgementRequiresSettledView', 'explicitCheckpointCompletion',
    'localeRetainsSemanticProgress', 'collapseBackgroundRequireResume', 'noAutomaticMovementOnResume', 'canonicalSceneRetained', 'syntheticApprovalOnly'],
  'no-profile': ['admissionDeniedRuEn', 'noJourneyNavigation', 'noJourneyProgress', 'canonicalSceneRetained', 'syntheticApprovalOnly'],
  'no-independent-journey-review': ['admissionDeniedRuEn', 'noJourneyNavigation', 'noJourneyProgress', 'canonicalSceneRetained', 'syntheticApprovalOnly'],
  'cold-progress-resume': ['restoredPaused', 'newDocumentRestoration', 'noAutomaticNavigationOrWrite', 'explicitResumeRequired',
    'exactWriterAfterResume', 'canonicalSceneRetainedWithinDocument'],
  'progress-write-retry': ['priorBytesPreservedOnWriteFailure', 'visiblyUnsavedLocalPrefix', 'explicitRetryConfirmsExactBytes', 'canonicalSceneRetained'],
  'future-progress-clear': ['unknownBytesPreservedRuEn', 'noUnknownRecordAdmission', 'confirmationBeforeDelete',
    'explicitDeleteConfirmedByReadback', 'noAutomaticProgressRewrite', 'canonicalSceneRetained'],
  'incompatible-progress-version': ['incompatibleProgressUnavailable', 'exactOldBytesPreservedRuEn',
    'noAutomaticNavigationOrRewrite', 'canonicalSceneRetainedWithinDocument'],
  'explicit-progress-migration': ['independentSyntheticMigrationReview', 'noMigrationBeforeConfirmation', 'cancellationRetainsBytesAndFocus',
    'originalHistoryRetained', 'exactPrefixTransferred', 'confirmedSaveReadback', 'exactWriterAfterTransfer', 'migratedColdRestorePaused',
    'noAutomaticNavigationOrWriteOnRestore', 'localeRetainsMigratedPrefix', 'explicitResumeRequiredAfterReload', 'canonicalSceneRetainedWithinDocument'],
  'migration-review-denied': ['missingIndependentMigrationReviewDenied', 'revokedIndependentMigrationReviewDenied',
    'revocationAcrossNewDocument', 'offeredConfirmationInvalidated', 'exactOldBytesPreserved', 'noInferredAcknowledgements',
    'noAutomaticNavigationOrWrite', 'canonicalSceneRetainedWithinDocument'],
  'history-prerequisite-admission': ['lockedBeforeExplicitCompletion', 'unlockedAfterConfirmedCompletion',
    'independentlyAdmittedLocaleEquivalence', 'completedColdRestoreNoWriteOrNavigation', 'revokedSavedLocaleReviewDeniesPrerequisite',
    'revokedSavedLocaleReviewDeniesRuntimeOffers', 'preservedExactCompletionBytes', 'syntheticIndependentReviewsOnly', 'canonicalSceneRetainedWithinDocument'],
  'explicit-history-select-delete': ['selectedRecordsPreserveAcknowledgements', 'selectionNeverNavigates', 'incompleteSelectionPaused',
    'deletionRequiresConfirmation', 'cancellationRetainsBytesAndFocus', 'failedDeletionWritePreservesBytes', 'explicitRetryConfirmsExactDeletion',
    'onlyChosenHistoryRecordDeleted', 'deletionRevokesDependentAdmission', 'currentSelectionRetainedUnavailable', 'canonicalSceneRetained'],
  'explicit-reader-policy': ['explicitPolicyOnly', 'unsavedDraftDoesNotGrantPolicy', 'localeDraftRetained', 'lifecycleRechecksPolicy', 'explicitDeleteConfirmed',
    'failedSaveDraftRetained', 'editedFailureRequiresExplicitSave', 'collectionDraftRetained', 'transientDeleteConfirmation', 'canonicalSceneRetained'],
  'future-profile-delete-recovery': ['futureRecordPreserved', 'failedDeleteDoesNotGrantPolicy', 'explicitDeleteRetryConfirmed', 'failedDeleteIntentRetained', 'canonicalSceneRetained'],
  'focus-invalidation-owned-confirm': ['manualRelease', 'noUnexpectedDeletion', 'onlyOriginalNextSave', 'canonicalSceneRetained'],
  'focus-invalidation-outside': ['manualRelease', 'noUnexpectedDeletion', 'onlyOriginalNextSave', 'canonicalSceneRetained'],
  'focus-keyboard-remount-lifecycle': ['pendingConsentDiscardedOnNewDocument', 'nativeBackgroundRetainsPausedPrefix',
    'noUnexpectedNavigationOrWrite', 'canonicalSceneRetainedWithinDocument'],
  'history-capacity-explicit-recovery': ['validFullSeedFromActualAppPrefix', 'fullColdRestoreNoWriteOrNavigation',
    'sameRecordResumeAndCompletionAtCapacity', 'newDependentStartDisabledAtCapacity', 'capacityExplanationRuEn',
    'disabledRouteExplained', 'keyboardManagementFocusesHistory', 'cancellationPreservesFullBytes',
    'explicitSingleHeldDeletionFreesSlot', 'failedDeletionWritePreservesFullBytes', 'localSlotRecoveryRemainsUnsavedUntilRetry',
    'explicitRetryConfirmsFreedSlot', 'originalCompletionAndOtherHistoryRetained', 'newStartUsesOnlyFreedSlot',
    'noAutomaticEvictionOrClear', 'canonicalSceneRetainedWithinDocument'],
  'explicit-activity-answer': ['wrongAnswerNoProgress', 'keyboardChoiceKeepsFocus', 'answerNoNavigationOrStorage',
    'correctRequiresExplicitNext', 'localeClearsAnswer', 'canonicalLocalizedChoices', 'activitySemanticFingerprintSaved',
    'answerNotPersisted', 'canonicalSceneRetainedWithinDocument', 'explicitCompletion'],
  'activity-lifecycle-revocation': ['backgroundClearsAnswer', 'coldRestorePausedWithoutAnswer', 'noAnswerReplayed',
    'revokedReviewHidesActivity', 'reviewRecoveryRequiresFreshAnswer', 'savedPrefixPreserved', 'noLifecycleProgressWrite'],
  'passport-confirmed-progress': ['ordinaryCountrySelectionNoCredit', 'workWriteFailureHidesUnconfirmedCounts',
    'workRetryConfirmsExactBytes', 'completedOnlyAfterExplicitFinish', 'defaultClosedNativeDisclosure',
    'keyboardDisclosureKeepsFocus', 'localeAndDisclosureNoWriteOrNavigation', 'historyManagementFocusOnly',
    'explicitRecordDeletionRequired', 'failedDeletionHidesConfirmedCredit', 'deletionRetryConfirmsExactBytes',
    'emptyAfterConfirmedDeletion', 'canonicalSceneRetainedWithinDocument'],
};
const actualAppCaptures = [], browserAttachments = [], images = [], scenarios = [], validatedBehavior = {};
for (const { original, name } of captures) {
  const app = await verifiedJson(original); assert.ok(Object.hasOwn(contracts, app.scenario)); scenarios.push(app.scenario);
  const expectedImages = { 'explicit-journey': 2, 'explicit-reader-policy': 2, 'future-profile-delete-recovery': 1,
    'progress-write-retry': 1, 'future-progress-clear': 1, 'explicit-progress-migration': 1,
    'history-prerequisite-admission': 1, 'explicit-history-select-delete': 1,
    'focus-invalidation-owned-confirm': 1, 'focus-invalidation-outside': 1, 'history-capacity-explicit-recovery': 2,
    'explicit-activity-answer': 2, 'passport-confirmed-progress': 2 };
  assert.equal(app.screenshots.length, expectedImages[app.scenario] ?? 0);
  const matching = attachments.filter(item => item.name === name + '-source-evidence' && item.path
    && normal(item.path).startsWith(normal(path.dirname(original.path)) + '/attachments/'));
  assert.equal(matching.length, 1);
  const attachment = await ref(matching[0].path); assert.equal(attachment.sha256, original.sha256);
  actualAppCaptures.push(original); browserAttachments.push(attachment);
  for (const flag of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[flag], true, flag);
  noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
    'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
  for (const field of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[field], []);
  await verifyInputs(app.sourceInputs);
  for (const input of app.sourceInputs) assert.equal(sourceMap.get(input.path), input.sha256, input.path);
  const observed = app.scenario.startsWith('focus-invalidation-') ? app.observations.focus
    : name === 'booky-journey' ? app.observations : app;
  for (const flag of contracts[app.scenario]) assert.equal(observed[flag], true, app.scenario + ':' + flag);
  validatedBehavior[app.scenario] = Object.fromEntries(contracts[app.scenario].map(flag => [flag, true]));
  if (name === 'booky-journey') {
    assert.equal(app.contentSubstitution.path, 'src/host/bookyJourneyContent.ts'); assert.equal(app.contentSubstitution.syntheticOnly, true);
    assert.match(app.contentSubstitution.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.equal(app.finalReaderPreference, app.initialReaderPreference);
    assert.equal(app.migrationContentSubstitution.path, 'src/host/bookyJourneyMigrationContent.ts');
    assert.equal(app.migrationContentSubstitution.syntheticOnly, true); assert.equal(app.migrationContentSubstitution.independentReceipt, true);
    assert.match(app.migrationContentSubstitution.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.equal(app.migrationContentSubstitution.nodeMap, 'explicit-identity');
    if (app.scenario === 'passport-confirmed-progress') {
      assert.equal(app.contentMode, 'approved'); assert.equal(app.initialProgressPreference, null);
      noApproval(observed, ['newPassportPersistenceCreated', 'passiveLearningCreditClaimed',
        'productionApprovalClaimed', 'fullAccessibilityAcceptanceClaimed']);
      assert.deepEqual(observed.acknowledgedCountSequence, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]);
      assert.deepEqual(observed.completedJourney, { id: 'test.actual-app-journey', version: 1 });
      const operations = app.operations.filter(item => item.key === 'probpera-booky-journey-progress-v1');
      assert.equal(operations.some(item => item.operation === 'remove'), false);
      const writes = operations.filter(item => item.operation === 'set');
      assert.equal(writes.length, 8); assert.deepEqual(writes.map((item, index) => item.failed ? index : null).filter(index => index !== null), [3, 6]);
      assert.equal(writes[3].value, writes[4].value); assert.equal(writes[6].value, writes[7].value);
      assert.equal(writes[7].value, app.finalProgressPreferenceRaw);
      const expectedPrefixes = [[], ['country'], ['country', 'writer'], ['country', 'writer', 'work'],
        ['country', 'writer', 'work'], ['country', 'writer', 'work', 'checkpoint'], null, null];
      const completed = JSON.parse(writes[5].value).records[0];
      assert.equal(completed.journeyId, 'test.actual-app-journey'); assert.equal(completed.journeyVersion, 1);
      assert.equal(completed.locale, 'ru'); assert.equal(completed.resumeNodeId, null);
      assert.equal(completed.recordId, sha(JSON.stringify([completed.policyFingerprint, completed.journeyId, completed.journeyVersion])));
      assert.deepEqual(completed.nodes.map(node => node.id), ['country', 'writer', 'work', 'checkpoint']);
      assert.deepEqual(completed.nodes.map(node => node.kind), ['country', 'writer', 'work', 'checkpoint']);
      assert.deepEqual(completed.nodes.map(node => node.screen), ['globe', 'globe', 'collection', 'globe']);
      for (const [index, write] of writes.entries()) {
        const preference = JSON.parse(write.value);
        assert.deepEqual(Object.keys(preference).sort(), ['activeRecordId', 'audience', 'records', 'revision', 'schemaVersion']);
        assert.equal(preference.schemaVersion, 1); assert.equal(preference.audience, 'adult');
        assert.ok(Number.isSafeInteger(preference.revision) && preference.revision > 0);
        assert.doesNotMatch(write.value, /"(?:passport|entities|completedJourneys|answer|choiceId)"/u);
        if (expectedPrefixes[index] === null) {
          assert.deepEqual(preference.records, []); assert.equal(preference.activeRecordId, null);
        } else {
          assert.equal(preference.records.length, 1); const record = preference.records[0];
          assert.equal(preference.activeRecordId, completed.recordId);
          assert.deepEqual(Object.keys(record).sort(), ['acknowledgedNodeIds', 'definitionChecksum', 'journeyId', 'journeyVersion',
            'locale', 'nodes', 'policyFingerprint', 'recordId', 'resumeNodeId']);
          assert.deepEqual(record, { ...completed, acknowledgedNodeIds: expectedPrefixes[index],
            resumeNodeId: completed.nodes[expectedPrefixes[index].length]?.id ?? null });
          for (const node of record.nodes) assert.deepEqual(Object.keys(node).sort(), ['entity', 'id', 'kind', 'screen']);
        }
      }
      for (const [field, index] of [['confirmedWorkSha256', 4], ['completedPreferenceSha256', 5], ['deletedPreferenceSha256', 7]]) {
        assert.equal(observed[field], sha(writes[index].value));
      }
      validatedBehavior[app.scenario].exactProgressWriteCount = writes.length;
      validatedBehavior[app.scenario].failedWriteIndices = [3, 6];
      validatedBehavior[app.scenario].confirmedProgressHashes = { work: observed.confirmedWorkSha256,
        completed: observed.completedPreferenceSha256, deleted: observed.deletedPreferenceSha256 };
    }
    if (['explicit-activity-answer', 'activity-lifecycle-revocation'].includes(app.scenario)) {
      assert.equal(app.contentMode, 'activity'); assert.equal(app.initialProgressPreference, null);
      const operations = app.operations.filter(item => item.key === 'probpera-booky-journey-progress-v1');
      assert.equal(operations.some(item => item.operation === 'remove' || item.failed), false);
      const writes = operations.filter(item => item.operation === 'set'), final = JSON.parse(app.finalProgressPreferenceRaw);
      const explicit = app.scenario === 'explicit-activity-answer';
      const expectedPrefixes = explicit ? [[], ['country'], ['country', 'activity'], ['country', 'activity', 'checkpoint']]
        : [[], ['country']];
      assert.equal(writes.length, expectedPrefixes.length);
      assert.equal(writes[writes.length - 1].value, app.finalProgressPreferenceRaw);
      assert.equal(final.records.length, 1); const record = final.records[0];
      assert.equal(final.activeRecordId, record.recordId); assert.equal(record.journeyId, 'test.actual-app-journey');
      assert.equal(record.journeyVersion, 1); assert.equal(record.locale, explicit ? 'en' : 'ru');
      assert.equal(record.recordId, sha(JSON.stringify([record.policyFingerprint, record.journeyId, record.journeyVersion])));
      assert.deepEqual(record.nodes.map(item => item.id), ['country', 'activity', 'checkpoint']);
      assert.deepEqual(record.nodes.map(item => item.kind), ['country', 'activity', 'checkpoint']);
      assert.deepEqual(record.nodes.map(item => item.screen), ['globe', 'globe', 'globe']);
      const activity = record.nodes[1];
      assert.deepEqual(Object.keys(activity).sort(), ['activity', 'entity', 'id', 'kind', 'screen']); assert.equal(activity.entity, null);
      assert.deepEqual(Object.keys(activity.activity).sort(), ['id', 'semanticChecksum', 'version']);
      assert.equal(activity.activity.id, 'test.match-author'); assert.equal(activity.activity.version, 1);
      assert.match(activity.activity.semanticChecksum, /^[a-f0-9]{64}$/u);
      for (const [index, write] of writes.entries()) {
        const preference = JSON.parse(write.value); assert.equal(preference.records.length, 1);
        assert.deepEqual(Object.keys(preference).sort(), ['activeRecordId', 'audience', 'records', 'revision', 'schemaVersion']);
        assert.equal(preference.schemaVersion, 1); assert.equal(preference.audience, 'adult');
        const saved = preference.records[0];
        assert.deepEqual(Object.keys(saved).sort(), ['acknowledgedNodeIds', 'definitionChecksum', 'journeyId', 'journeyVersion',
          'locale', 'nodes', 'policyFingerprint', 'recordId', 'resumeNodeId']);
        assert.equal(saved.recordId, record.recordId); assert.equal(preference.activeRecordId, saved.recordId);
        assert.deepEqual(saved.nodes, record.nodes); assert.deepEqual(saved.acknowledgedNodeIds, expectedPrefixes[index]);
        assert.equal(saved.resumeNodeId, record.nodes[expectedPrefixes[index].length]?.id ?? null);
        assert.doesNotMatch(write.value, /"(?:choiceId|correctChoiceId|answer|activityChoices|spec|choices|targetWork|label)"/u);
      }
    }
    if (app.scenario === 'explicit-progress-migration') {
      assert.equal(observed.fromVersion, 1); assert.equal(observed.toVersion, 2);
      assert.deepEqual(observed.exactAcknowledgedPrefix, ['country']);
      const { original, migrated } = observed.migrationRecords, final = JSON.parse(app.finalProgressPreferenceRaw);
      assert.equal(original.journeyVersion, 1); assert.equal(migrated.journeyVersion, 2);
      assert.notEqual(original.recordId, migrated.recordId); assert.equal(original.policyFingerprint, migrated.policyFingerprint);
      assert.deepEqual(original.acknowledgedNodeIds, ['country']); assert.deepEqual(migrated.acknowledgedNodeIds, ['country']);
      assert.deepEqual(original.nodes, migrated.nodes); assert.equal(migrated.resumeNodeId, 'writer');
      assert.equal(final.records.length, 2);
      assert.deepEqual(final.records.find(item => item.recordId === original.recordId), original);
      const active = final.records.find(item => item.recordId === final.activeRecordId);
      assert.equal(active.journeyVersion, 2); assert.deepEqual(active.acknowledgedNodeIds, ['country']);
    }
    if (app.scenario === 'migration-review-denied') {
      assert.equal(observed.savedVersion, 1); assert.equal(observed.currentReviewedVersion, 2);
      assert.equal(observed.sameDocumentContentRefreshClaimed, false);
      const final = JSON.parse(app.finalProgressPreferenceRaw); assert.equal(final.records.length, 1);
      assert.equal(final.records[0].journeyVersion, 1); assert.deepEqual(final.records[0].acknowledgedNodeIds, ['country']);
    }
    if (app.scenario === 'history-prerequisite-admission') {
      const completed = observed.completedRecord, final = JSON.parse(app.finalProgressPreferenceRaw);
      assert.equal(observed.requiredJourneyId, 'test.actual-app-journey'); assert.equal(observed.requiredVersion, 1);
      assert.equal(observed.dependentJourneyId, 'test.dependent-journey');
      assert.equal(completed.journeyId, observed.requiredJourneyId); assert.equal(completed.journeyVersion, observed.requiredVersion);
      assert.equal(completed.locale, 'ru'); assert.equal(completed.resumeNodeId, null);
      assert.deepEqual(completed.acknowledgedNodeIds, completed.nodes.map(node => node.id));
      assert.deepEqual(final.records, [completed]); assert.equal(final.activeRecordId, completed.recordId);
    }
    if (app.scenario === 'explicit-history-select-delete') {
      const deleted = observed.deletedRecord, retained = observed.retainedRecord, final = JSON.parse(app.finalProgressPreferenceRaw);
      assert.equal(observed.failurePort, 'native-preferences-set'); assert.notEqual(deleted.recordId, retained.recordId);
      assert.equal(deleted.policyFingerprint, retained.policyFingerprint);
      assert.equal(deleted.resumeNodeId, null); assert.deepEqual(deleted.acknowledgedNodeIds, deleted.nodes.map(node => node.id));
      assert.deepEqual(retained.acknowledgedNodeIds, []); assert.equal(retained.resumeNodeId, 'country');
      assert.deepEqual(final.records, [retained]); assert.equal(final.activeRecordId, retained.recordId);
    }
    if (app.scenario === 'history-capacity-explicit-recovery') {
      assert.deepEqual([observed.fullCount, observed.freedCount, observed.finalCount], [32, 31, 32]);
      assert.equal(observed.productionApprovalClaimed, false); assert.equal(observed.fullAccessibilityAcceptanceClaimed, false);
      const seed = observed.capacitySeed, genuine = seed.genuineRecord;
      assert.equal(seed.heldRecordsUnreviewed, true); assert.equal(seed.suppliedAtFreshDocumentBoundary, true);
      assert.deepEqual(genuine.acknowledgedNodeIds, ['country']); assert.equal(genuine.resumeNodeId, 'writer');
      const held = Array.from({ length: 31 }, (_, index) => {
        const journeyId = 'test.held-history-' + index;
        return { ...genuine, journeyId, recordId: sha(JSON.stringify([genuine.policyFingerprint, journeyId, genuine.journeyVersion])) };
      });
      assert.deepEqual(seed.heldRecordIds, held.map(item => item.recordId)); assert.equal(new Set(seed.heldRecordIds).size, 31);
      const operations = app.operations.filter(item => item.key === 'probpera-booky-journey-progress-v1');
      assert.equal(operations.some(item => item.operation === 'remove'), false);
      const genuineWrite = operations.find(item => item.operation === 'set' && !item.failed && sha(item.value) === seed.genuinePreferenceSha256);
      assert.ok(genuineWrite); const genuinePreference = JSON.parse(genuineWrite.value);
      assert.deepEqual(genuinePreference.records, [genuine]); assert.equal(genuinePreference.activeRecordId, genuine.recordId);
      assert.equal(sha(JSON.stringify({ ...genuinePreference, records: [genuine, ...held] })), seed.seededPreferenceSha256);
      const completed = observed.retainedCompletedRecord, removed = observed.removedRecord;
      assert.equal(completed.recordId, genuine.recordId); assert.deepEqual(completed.nodes, genuine.nodes);
      assert.deepEqual(completed.acknowledgedNodeIds, completed.nodes.map(item => item.id)); assert.equal(completed.resumeNodeId, null);
      assert.deepEqual(removed, held[0]); const remaining = [completed, ...held.slice(1)];
      const failed = operations.filter(item => item.failed); assert.equal(failed.length, 1); assert.equal(failed[0].operation, 'set');
      const freed = JSON.parse(failed[0].value); assert.deepEqual(freed.records, remaining); assert.equal(freed.activeRecordId, completed.recordId);
      assert.equal(sha(failed[0].value), observed.freedPreferenceSha256);
      assert.ok(operations.some(item => item.operation === 'set' && !item.failed && item.value === failed[0].value));
      const final = JSON.parse(app.finalProgressPreferenceRaw), active = final.records.find(item => item.recordId === final.activeRecordId);
      assert.equal(final.records.length, 32); assert.deepEqual(final.records.filter(item => item !== active), remaining);
      assert.equal(active.journeyId, 'test.dependent-journey'); assert.deepEqual(active.acknowledgedNodeIds, []);
      assert.equal(active.resumeNodeId, 'country'); assert.equal(final.records.some(item => item.recordId === removed.recordId), false);
    }
    if (app.scenario === 'explicit-journey') assert.equal(app.observations.durableJourneyProgressClaimed, false);
    if (app.scenario === 'cold-progress-resume') assert.deepEqual(observed.confirmedPrefix, ['country']);
    if (app.scenario === 'progress-write-retry') {
      assert.equal(observed.failurePort, 'native-preferences-set');
      assert.deepEqual(observed.failedWrite.persisted.records[0].acknowledgedNodeIds, []);
      assert.deepEqual(observed.failedWrite.pending.records[0].acknowledgedNodeIds, ['country']);
      assert.deepEqual(JSON.parse(app.finalProgressPreferenceRaw), observed.failedWrite.pending);
    }
    if (app.scenario === 'future-progress-clear') assert.equal(app.finalProgressPreferenceRaw, null);
    if (app.scenario === 'incompatible-progress-version') {
      assert.equal(observed.savedVersion, 1); assert.equal(observed.currentReviewedVersion, 2);
      const saved = JSON.parse(app.finalProgressPreferenceRaw);
      const active = saved.records.find(item => item.recordId === saved.activeRecordId);
      assert.equal(active.journeyVersion, 1); assert.deepEqual(active.acknowledgedNodeIds, ['country']);
    }
    if (app.scenario.startsWith('focus-')) {
      assert.equal(observed.fullAccessibilityAcceptanceClaimed, false);
      const saved = JSON.parse(app.finalProgressPreferenceRaw);
      assert.equal(saved.records.length, 1); assert.equal(saved.activeRecordId, saved.records[0].recordId);
      assert.deepEqual(saved.records[0].acknowledgedNodeIds, ['country']); assert.equal(saved.records[0].resumeNodeId, 'writer');
      const operations = app.operations.filter(item => item.key === 'probpera-booky-journey-progress-v1');
      assert.equal(operations.some(item => item.operation === 'remove'), false);
      if (app.scenario.startsWith('focus-invalidation-')) {
        const outside = app.scenario === 'focus-invalidation-outside';
        assert.equal(observed.heldPort, 'native-preferences-set');
        assert.equal(observed.focusedAtInvalidation, outside ? 'history-delete-outside' : 'clear-confirm');
        assert.equal(observed.expectedAfterInvalidation, outside ? 'same-history-delete' : 'storage-status');
        assert.deepEqual(observed.keyboard, ['Enter on Next', 'Tab to clear', 'Enter to open confirmation', ...(outside ? ['Shift+Tab outside'] : [])]);
        const held = operations.filter(item => item.manuallyHeld);
        assert.equal(held.length, 1); assert.equal(held[0].operation, 'set'); assert.equal(held[0].manuallyReleased, true);
        assert.equal(held[0].value, app.finalProgressPreferenceRaw);
      } else {
        assert.deepEqual(observed.keyboardCancellationTargets, ['reset', 'history-delete', 'clear-all']);
        assert.deepEqual(observed.keyboard, ['Enter opens', 'Tab reaches cancel', 'Enter cancels']);
      }
    }

  } else {
    assert.equal(app.noNewDialogueOrJourneyEnabled, true); assert.equal(app.finalReaderPreference, null);
    for (const field of ['customizationWrites', 'unexpectedPreferenceWrites']) assert.deepEqual(app[field], []);
  }
  for (const image of app.screenshots) {
    assert.match(image.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(image.framing?.trim());
    if (['progress-write-retry', 'future-progress-clear', 'explicit-progress-migration', 'focus-invalidation-owned-confirm', 'focus-invalidation-outside'].includes(app.scenario)) {
      assert.equal(image.bounds.status.fullyInViewport, true); assert.equal(image.bounds.action.fullyInViewport, true);
      assert.equal(image.bounds.actionHit, true); assert.ok(image.bounds.action.height >= 44);
      if (app.scenario === 'progress-write-retry') assert.equal(image.width, 320);
      if (app.scenario.startsWith('focus-invalidation-')) {
        assert.equal(image.filename, app.scenario === 'focus-invalidation-outside' ? 'journey-focus-outside-en.png' : 'journey-focus-restored-ru.png');
        assert.deepEqual([image.width, image.height], [1440, 850]);
      }
    }
    if (['history-prerequisite-admission', 'explicit-history-select-delete'].includes(app.scenario)) {
      assert.equal(image.bounds.surface.fullyInViewport, true); assert.equal(image.bounds.action.fullyInViewport, true);
      assert.equal(image.bounds.actionHit, true); assert.ok(image.bounds.action.height >= 44);
      if (app.scenario === 'history-prerequisite-admission') {
        assert.equal(image.filename, 'journey-history-complete-en.png'); assert.deepEqual([image.width, image.height], [1440, 850]);
      } else {
        assert.equal(image.filename, 'journey-history-delete-ru-320.png'); assert.deepEqual([image.width, image.height], [320, 900]);
      }
    }
    if (app.scenario === 'history-capacity-explicit-recovery') {
      assert.equal(image.bounds.action.fullyInViewport, true); assert.equal(image.bounds.actionHit, true);
      assert.ok(image.bounds.action.height >= 44);
      if (image.filename === 'journey-capacity-full-ru-320.png') {
        assert.equal(image.bounds.status.fullyInViewport, true); assert.deepEqual([image.width, image.height], [320, 900]);
      } else {
        assert.equal(image.filename, 'journey-capacity-recovered-en.png');
        assert.equal(image.bounds.surface.fullyInViewport, true); assert.deepEqual([image.width, image.height], [1440, 850]);
      }
    }
    if (app.scenario === 'explicit-activity-answer') {
      assert.equal(image.bounds.surface.fullyInViewport, true); assert.equal(image.bounds.feedback.fullyInViewport, true);
      assert.equal(image.bounds.overflow, false); assert.equal(image.bounds.choices.length, 2);
      for (const choice of image.bounds.choices) {
        assert.equal(choice.fullyInViewport, true); assert.equal(choice.hit, true); assert.ok(choice.height >= 44);
      }
      if (image.filename === 'journey-activity-incorrect-ru-320.png') assert.deepEqual([image.width, image.height], [320, 900]);
      else { assert.equal(image.filename, 'journey-activity-correct-en.png'); assert.deepEqual([image.width, image.height], [1440, 850]); }
    }
    if (app.scenario === 'passport-confirmed-progress') {
      const { surface, summary, status, counts, completed, manage, overflow } = image.bounds;
      assert.equal(surface.fullyInViewport, true); assert.equal(status.fullyInViewport, true); assert.equal(overflow, false);
      assert.equal(counts.length, 3);
      for (const box of [...counts, ...completed]) assert.equal(box.fullyInViewport, true);
      for (const box of [summary, manage]) {
        assert.equal(box.fullyInViewport, true); assert.equal(box.hit, true); assert.ok(box.height >= 44 && box.width >= 44);
      }
      if (image.filename === 'journey-passport-confirmed-ru-320.png') {
        assert.deepEqual([image.width, image.height], [320, 900]); assert.equal(completed.length, 0);
      } else {
        assert.equal(image.filename, 'journey-passport-completed-en.png');
        assert.deepEqual([image.width, image.height], [1440, 850]); assert.equal(completed.length, 1);
      }
    }
    const reference = { path: path.join(path.dirname(original.path), image.filename), sha256: image.sha256 };
    const bytes = await verify(reference); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [image.width, image.height]); images.push(reference);
  }
}
assert.deepEqual(scenarios.sort(), Object.keys(contracts).sort()); assert.equal(images.length, entry.expectedImages);
assert.equal(new Set(images.map(item => normal(item.path))).size, images.length);
const refSet = items => items.map(item => ({ path: normal(item.path), sha256: item.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
assert.deepEqual(refSet(visual.actualAppCaptures), refSet(actualAppCaptures)); assert.deepEqual(refSet(visual.images), refSet(images));
noApproval(visual, ['artAccepted', 'childApproved', 'releaseReady']);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.ok(image.reviewer?.trim());
  assert.ok(Array.isArray(image.findings) && image.findings.length && image.findings.every(item => typeof item === 'string' && item.trim()));
  await verify(image);
  if (image.priorInspection) {
    const proof = image.priorInspection, previousReview = await verifiedJson(proof);
    assert.equal(previousReview.pass, true); assert.notEqual(normal(proof.path), normal(visualPath));
    assert.equal(proof.imageSha256, image.sha256);
    const previousImage = previousReview.images.find(item => normal(item.path) === normal(proof.imagePath));
    assert.ok(previousImage); assert.equal(previousImage.inspected, true); assert.equal(previousImage.sha256, image.sha256);
    assert.ok(previousImage.reviewer?.trim());
    assert.ok(Array.isArray(previousImage.findings) && previousImage.findings.length);
    await verify(previousImage);
  }
}

async function artifactEvidence(record, expectedSource, fresh) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, expectedSource); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  noApproval(record, ['stageAccepted', 'releaseReady', 'productionActionsPerformed']);
  if (fresh) assert.ok(normal(record.artifact.path).startsWith(artifacts + '/'));
  const manifestRef = { path: record.artifact.path + '/artifact.json', sha256: record.artifact.artifactSha256 ?? record.artifact.sha256 };
  const manifest = await verifiedJson(manifestRef);
  assert.equal(manifest.sourceCommit, expectedSource); assert.equal(manifest.buildId, record.buildId);
  assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  if (fresh) {
    await verifyInputs(manifest.sourceInputs.files);
    for (const file of runtimeRequired) assert.ok(manifest.sourceInputs.files.some(item => item.path === file && item.sha256 === sourceMap.get(file)), file);
  }
  for (const item of manifest.inventory) await verify({ ...item, path: path.join(record.artifact.path, item.path) });
  if (record.apk) await verify(record.apk);
  return manifestRef;
}
const pwaPath = folder + '/pwa-a1/result.json', androidPath = folder + '/android-a1/result.json';
const pwa = await read(pwaPath), android = await read(androidPath), buildManifests = [];
for (const record of [pwa, android]) buildManifests.push(await artifactEvidence(record, sourceCommit, true));
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.equal(pwa.localQaAuthority, true); assert.equal(pwa.installedDevice, false); assert.equal(android.nativeExecutionVerified, false); assert.equal(android.iosCompiled, false);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
const pwaBrowserPath = folder + '/pwa-a1/playwright.json', pwaBrowser = await read(pwaBrowserPath);
assert.deepEqual([pwaBrowser.stats.expected, pwaBrowser.stats.unexpected, pwaBrowser.stats.skipped, pwaBrowser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(pwaBrowser.errors, []);
const buildAudits = [];
for (const [kind, file] of [['pwa', folder + '/pwa-a1/strict-audit.json'],
  ...['strictRuntimeAudit', 'binaryAudit', 'build'].map(key => [key, android.checks[key]])]) {
  const audit = await read(file); assert.equal(audit.pass, true);
  const identity = kind === 'binaryAudit' ? audit.sourceArtifact : kind === 'build' ? audit : audit.identity;
  assert.equal(identity.sourceCommit, sourceCommit); assert.equal(identity.buildId, kind === 'pwa' ? pwa.buildId : android.buildId);
  if (kind === 'binaryAudit') { assert.equal(audit.apk.sha256, android.apk.sha256); await verifyInputs([...audit.rawReports, audit.zip.ledger]); }
  buildAudits.push(await ref(file));
}
const copyPath = folder + '/pwa-a1/copy-verification.json', copy = await read(copyPath);
assert.equal(copy.pass, true); assert.equal(copy.files, pwa.artifact.files); assert.equal(copy.bytes, pwa.artifact.bytes);
assert.equal(copy.artifactManifest.sha256, pwa.artifact.artifactSha256); await verifyInputs([copy.artifactManifest, copy.detailedLedger]);
const buildBaselinePath = folder + '/build-baseline.json', buildBaseline = await read(buildBaselinePath), retainedBuilds = [];
assert.equal(buildBaseline.checkpoint, entry.checkpoint);
for (const [kind, reference, prefix] of [['pwa', buildBaseline.priorPwa, '78d4c8ad'], ['android', buildBaseline.priorAndroid, 'ef6fa867']]) {
  assert.equal(reference.sourceCommit, '67838a7c59792ad3abe2abff63cf7be01e7460bb'); assert.ok(reference.buildId.startsWith(prefix));
  assert.equal(reference.path, `docs/mobile/evidence/S15/journey-activity-20260923/${kind}-a1/result.json`);
  const record = await verifiedJson(reference); assert.equal(record.buildId, reference.buildId);
  retainedBuilds.push({ kind, result: reference, artifactManifest: await artifactEvidence(record, reference.sourceCommit, false),
    apk: record.apk ?? null, sourceCommit: record.sourceCommit, buildId: record.buildId, runtimePayloadRehashed: true,
    journeyRuntimeIncluded: true, journeyPersistenceIncluded: true, journeyMigrationIncluded: true, journeyHistoryIncluded: true, journeyFocusFixIncluded: true, journeyCapacityIncluded: true, journeyActivityIncluded: true, journeyPassportIncluded: false });
}
const buildHelpers = await Promise.all(['build-pwa-a1.mjs', 'pwa-a1.config.mjs', 'build-android-a1.ps1',
  'verify-android-a1.mjs', 'preserve-android-a1.mjs', 'build-baseline.json'].map(file => ref(folder + '/' + file)));

const globals = ['AUTOPILOT_STATE.json', 'DECISIONS.md', 'STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt',
  'REQUIREMENTS_TRACEABILITY.json', 'REQUIREMENTS_TRACEABILITY.csv'].map(file => 'docs/mobile/' + file);
const originals = new Map(await Promise.all(globals.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originals.get(globals[0])), trace = JSON.parse(originals.get(globals[5])), beforeTrace = structuredClone(trace);
const statuses = () => state.stages.map(stage => [stage.id, stage.status, stage.criteria.map(item => [item.id, item.status])]), beforeStatuses = statuses();
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 }); assert.equal(state.headSha, prior.sourceCommit);
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance'); assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance');
assert.equal(state.verificationCache.s15BookyJourneyActivity.path, entry.previous); await verify(state.verificationCache.s15BookyJourneyActivity);
assert.equal(state.verificationCache.s15BookyJourneyPassport, undefined);
const stage = state.stages.find(item => item.id === 'S15'), criterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-008');
const requirement = trace.requirements.find(item => item.id === 'PLANETKA-008');
for (const item of [stage, criterion, requirement]) assert.equal(item.status, 'IN_PROGRESS');
assert.equal([...originals.get(globals[1]).matchAll(/^- D170:/gmu)].length, 1); assert.equal(/^- D171:/mu.test(originals.get(globals[1])), false);
const marker = '<!-- s15-journey-passport-20260923:begin -->';
for (const file of globals.slice(2, 5)) assert.equal(originals.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = "Continue the audited S15 journey-model gap with an optional independently reviewed route overview: description and estimated duration, plus current derived offline availability. Extend strict compiled-plan validation and preserve exact policy/locale/activity/review bindings, confirmed passport credit, explicit history controls, capacity recovery and the canonical scene. Keep remaining node-kind requirements visible and reviewed production content a separate dependency; do not fabricate route, dialogue, child, narration, badge or reward approval. Formal accessibility, installed-device/performance, iOS and stage/release acceptance remain pending; S03.acceptance stays first unresolved.";
const limitations = [
  "The optional adult literary passport derives unique country, writer and work counts only from confirmed explicitly acknowledged navigation steps. Completion titles require fresh whole-route admission in both saved and current locales, including current policy, prerequisites and activity identity. Ordinary selection, cursor movement and activity choices do not earn passport credit.",
  "The passport has no separate persistence. Pending or failed progress saves/deletions hide counts until exact readback succeeds. The actual-App case verifies failed work acknowledgement and single-history deletion, exact-byte retries, locale changes, keyboard disclosure and deliberate history focus without passive writes or navigation.",
  "Fresh unit and TypeScript checks plus 20 actual-App Chrome cases share one current source manifest, including all 19 previous behavior cases. Eighteen captures require direct inspection or authenticated identical bytes from an earlier inspection. Content substitutions and receipts are synthetic only; production providers remain empty and all 34 existing dialogues remain draft.",
  "Fresh PWA and Android-dev artifacts bind the source; built-PWA coverage remains offline/download smoke. Native preference fixtures, APK bytes and signatures do not establish installed-device execution or durability. No formal accessibility, child, narration, art, performance, iOS, stage or release acceptance is claimed, and no production action occurs."
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_JOURNEY_PASSPORT_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: entry.previousCheckpointResult, checkpointHelper: await ref(folder + '/checkpoint.mjs'),
  sourceManifest, sourceCommits, attempts: { ...attempts, pwa: 'a1', android: 'a1' }, runs, earlierAttempts,
  unitFiles: entry.unitFiles, unitCount: cases.length, unitRerun: true, browserCases: entry.expectedBrowserTests, actualAppCaptures, browserAttachments, attachmentBytesMatchOriginal: true,
  validatedBehavior, visualReview: await ref(visualPath), inspectedImageCount: images.length,
  protectedSourceAuthority: entry.priorSourceManifest, unchangedTrackedInputCount: 1624, protectedInputsVerified: true,
  changedSourcePaths: changed, newSourcePaths: added, newImplementationFiles: entry.newImplementationFiles,
  changedSourceGitBlobCount: 4, addedSourceGitBlobCount: 4, gitIdentityDifferences,
  productionContentSource: { path: 'src/host/bookyJourneyContent.ts', sha256: sourceMap.get('src/host/bookyJourneyContent.ts') },
  productionMigrationContentSource: { path: 'src/host/bookyJourneyMigrationContent.ts', sha256: sourceMap.get('src/host/bookyJourneyMigrationContent.ts') },
  productionJourneyCount: 0, approvedProductionDialogueCount: 0, combinedDraftCount: 34,
  productionInventorySources, productionInventorySourcesRehashed: true, productionActivityCount: 0,
  productionHistoricalDefinitionCount: 0, productionMigrationCount: 0, approvedProductionMigrationReceiptCount: 0,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildManifests, buildAudits, buildHelpers, buildBaseline: await ref(buildBaselinePath), retainedBuilds,
  copyVerification: await ref(copyPath), pwaBrowserReport: await ref(pwaBrowserPath), buildsRebuilt: true, browserRerun: true,
  exactFreshArtifactInputsVerifiedAgainstSourceCommit: true, criteriaUpdated: ['S15.PLANETKA-008'], criterionChanges: [], requirementChanges: [], stageChanges: [],
  allStageAndCriterionStatusesUnchanged: true, counts, firstUnresolved: 'S03.acceptance', decisionD171Recorded: true, nextAction, limitations,
  actualApp: true, actualCss: true, actualGlobe: true, runtimeWiringImplemented: true, canonicalSceneRetained: true,
  durableExplicitSemanticCheckpoints: true, durableJourneyProgressImplemented: true, journeyCheckpointMigrationImplemented: true, explicitReviewedJourneyMigrationImplemented: true,
  unsupportedOrIncompatibleProgressPreserved: true, automaticRouteVersionMigrationImplemented: false,
  originalMigrationHistoryPreserved: true, prerequisiteHistoryIntegrationImplemented: true, deliberateHistoryControlsImplemented: true,
  savedJourneyCapacityStatusImplemented: true, explicitHistoryCapacityRecoveryImplemented: true, automaticHistoryEvictionImplemented: false,
  confirmationFocusOwnershipImplemented: true, keyboardConsentLifecycleLocallyVerified: true, fullAccessibilityAccepted: false,
  guardedAdultAuthorMatchingActivityImplemented: true, ephemeralAnswersOnly: true, explicitActivityAcknowledgementRequired: true,
  activitySemanticIdentityPersisted: true, answerChoicePersisted: false, automaticActivityAcknowledgementImplemented: false,
  confirmedLiteraryPassportImplemented: true, passportRequiresFreshAdmission: true, unconfirmedPassportCreditHidden: true,
  passportSeparatePersistenceImplemented: false, passiveLearningCreditImplemented: false, passportDisclosureReadOnly: true,
  productionJourneysEnabled: false, reviewedDialogueAccepted: false, childApproved: false, childProfileCreated: false, childAccessGranted: false,
  narrationEnabled: false, ageAdaptiveJourneysAccepted: false, installedNativeDevice: false, devicePerformanceAccepted: false,
  iosCompiled: false, artAccepted: false, screenReaderAcceptance: false, stageAccepted: false, productionActionsPerformed: false, releaseReady: false };
const scopedNote = ` Added a read-only adult literary passport from confirmed acknowledged navigation steps and freshly admitted completed journeys. Pending/failed saves hide credit; exact retry restores it, and confirmed single-history deletion removes its contribution. Fresh ${cases.length} unit tests from ${entry.unitFiles.length} files, TypeScript, ${entry.expectedBrowserTests} actual-App Chrome cases and ${images.length} inspected captures bind PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. All 1,624 protected inputs stay exact. Production inventories remain empty; 34 dialogues stay draft. PLANETKA-008 remains IN_PROGRESS without stage, device or release acceptance.`;
const push = (items, value) => { if (!items.includes(value)) items.push(value); };
for (const item of [criterion, requirement]) { item.commit = sourceCommit; item.notes += scopedNote; push(item.evidence, resultPath); }
criterion.lastValidatedAt = recordedAt;
for (const file of runtimeRequired) push(requirement.implementationFiles, file);
for (const file of [...entry.unitFiles, 'tests/pwa/booky-journey.spec.mjs', 'tests/pwa/booky-reader-policy.spec.mjs']) push(requirement.tests, file);
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path, ...Object.values(runs).map(item => item.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/build-pwa-a1.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android-a1.ps1 ${sourceCommit}`,
  `node ${folder}/preserve-android-a1.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction;
for (const file of [resultPath, pwaPath, androidPath]) push(state.resume.contextFiles, file);
push(state.resume.doNotRepeat, 'S15 passport credit uses only confirmed progress with fresh policy, locale, review, prerequisite and activity-semantic admission. Disclosure, locale changes and history-focus actions never write or navigate. Preserve exact retry/deletion proof and all prior journey behavior; next add the audited optional reviewed overview/duration and current derived offline availability with strict compiled-plan validation, without inventing approved production content.');
state.verificationCache.s15BookyJourneyPassport = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status,
  pwa: result.pwa, android: result.android, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
assert.deepEqual(trace.requirements.map(item => [item.id, item.status]), beforeTrace.requirements.map(item => [item.id, item.status]));
assert.deepEqual(trace.requirements.filter(item => item.id !== 'PLANETKA-008'), beforeTrace.requirements.filter(item => item.id !== 'PLANETKA-008'));
const rows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originals.get(globals[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(beforeTrace, rows));
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ':' + scopedNote + '\nPLANETKA-008 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/journey-passport-20260923/result.json.\n' + nextAction + '\n<!-- s15-journey-passport-20260923:end -->\n\n';
const updates = new Map([[globals[0], json(state)], [globals[1], originals.get(globals[1]) + '\n- D171: Source ' + sourceCommit + scopedNote + ' Evidence: evidence/S15/journey-passport-20260923/result.json.\n'],
  ...globals.slice(2, 5).map(file => [file, note + originals.get(file)]), [globals[5], json(trace)], [globals[6], projectTraceabilityCsv(trace, rows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' }); clean();
await verifyInputs(entry.checkpointFiles);
for (const [file, contents] of originals) assert.equal(await fs.readFile(file, 'utf8'), contents, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
await fs.writeFile(readmePath, '# S15 adult Booky confirmed literary passport\n\nSource: ' + sourceCommit + '.\n\n' + scopedNote.trim()
  + '\n\n' + limitations.map(item => '- ' + item).join('\n') + '\n\nNext: ' + nextAction + '\n', { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount: cases.length, unitRerun: true, browserCases: entry.expectedBrowserTests, inspectedImages: images.length,
  sourceInputs: 1632, protectedInputs: 1624, counts, firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
