import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Execute only after the exact source commit, matching final checks, actual
// visual inspection and fresh preserved PWA/Android builds. No tests run here.
// CLI: checkpoint.mjs SOURCE UNIT STATIC BROWSER [PWA=a1] [ANDROID=a1]
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, pwaAttempt = 'a1', androidAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt, pwaAttempt, androidAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/reader-policy-integration-20260923';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-reader-policy';
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const gitIdentityDifferences = new Map(), verifiedCommittedInputs = new Set();
const utf8TextExtensions = new Set(['.bat', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.txt', '.csv', '.svg', '.geojson']);
async function verifyGitIdentity(commit, input) {
  const identityKey = commit + ':' + input.path + ':' + input.sha256;
  if (verifiedCommittedInputs.has(identityKey)) return;
  const blob = gitBytes(['show', commit + ':' + input.path]), gitBlobSha256 = sha(blob);
  if (gitBlobSha256 === input.sha256) { verifiedCommittedInputs.add(identityKey); return; }
  assert.ok(utf8TextExtensions.has(path.extname(input.path)), 'Non-text Git identity differs: ' + input.path);
  const checkedOut = await fs.readFile(input.path); assert.equal(sha(checkedOut), input.sha256, input.path);
  const blobText = blob.toString('utf8'), text = checkedOut.toString('utf8');
  assert.ok(Buffer.from(blobText, 'utf8').equals(blob)); assert.ok(Buffer.from(text, 'utf8').equals(checkedOut));
  assert.equal(blobText.replaceAll('\r\n', '\n'), text.replaceAll('\r\n', '\n'), 'Git content drift: ' + input.path);
  gitIdentityDifferences.set(commit + ':' + input.path, { commit, path: input.path, gitBlobSha256,
    checkedOutSha256: input.sha256, lineEndingOnly: true });
  verifiedCommittedInputs.add(identityKey);
}
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/booky-reader-policy.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length);
  assert.equal(new Set(inputs.map(item => normalized(item.path))).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
async function optionalRef(file) { try { return await ref(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const noApproval = (record, flags = ['stageAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const requireInputs = (inputs, files) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), 'Missing source binding: ' + file); };
const entry = await read(folder + '/entry.json'), changed = entry.changedPaths, added = entry.newSourcePaths;
assert.equal(entry.stage, 'S15'); assert.equal(entry.expectedBrowserTests, 2); noApproval(entry); assert.equal(entry.childApproved, false);
assert.equal(changed.length, 7); assert.equal(added.length, 8); assert.equal(entry.unitFiles.length, 10);
assert.deepEqual(added, entry.newImplementationFiles);
const required = [...changed, ...added]; assert.equal(new Set(required).size, 15);
const runtimeRequired = required.filter(file => file.startsWith('src/') && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file));
assert.equal(runtimeRequired.length, 9);
assert.ok(added.includes('tests/pwa/booky-reader-policy.spec.mjs'));
// Chrome uses the real native host adapter. The separate Web adapter has unit
// evidence and is bound as source by both builds, not exercised by these cases.
const browserRequired = [...runtimeRequired.filter(file => file !== 'src/platform/adapters/web/WebPlatformAdapter.ts'),
  'src/host/bookyJourneyHost.ts', 'tests/pwa/booky-reader-policy.spec.mjs'];
assert.match(entry.checkpoint, /^[a-f0-9]{40}$/u); assert.notEqual(sourceCommit, entry.checkpoint);
git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]); cleanSource();
const sourceCommits = git(['rev-list', '--reverse', entry.checkpoint + '..' + sourceCommit]).split(/\r?\n/u).filter(Boolean);
assert.ok(sourceCommits.length > 0);
for (const commit of sourceCommits) {
  const paths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', commit]).split(/\r?\n/u).filter(Boolean);
  assert.ok(paths.length > 0); for (const file of paths) assert.ok(required.includes(file), 'Unexpected source-commit path: ' + commit + ':' + file);
}
assert.equal(entry.previousCheckpointResult.path, entry.previous);
const prior = await verifyRef(entry.previousCheckpointResult); assert.equal(prior.pass, true); noApproval(prior);
assert.deepEqual(entry.priorSourceManifest, prior.sourceManifest);
const baseline = await verifyRef(entry.priorSourceManifest);
assert.equal(baseline.files.length, 1590); assert.equal(entry.priorSourceManifest.fileCount, 1590);
assert.equal(prior.previousRuntime.path, entry.previousRuntime);
const priorRuntime = await verifyRef(prior.previousRuntime); assert.equal(priorRuntime.pass, true); noApproval(priorRuntime);
await verifyInputs(entry.checkpointFiles);
const protectedFiles = baseline.files.filter(item => !changed.includes(item.path));
assert.equal(protectedFiles.length, 1583); await verifyInputs(protectedFiles);
requireInputs(baseline.files, changed);
for (const file of added) assert.ok(!baseline.files.some(item => item.path === file), 'Added input already in baseline: ' + file);
assert.deepEqual(git(['diff', '--name-only', entry.checkpoint, sourceCommit, '--', 'src', 'scripts/mobile', 'tests/pwa']).split(/\r?\n/u).filter(Boolean).sort(), required.slice().sort());
requireInputs(protectedFiles, ['src/components/GlobeCameraRig.tsx', 'src/components/LiteraryGlobe.tsx',
  'src/components/LiteraryWorldMap.tsx', 'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts',
  'src/assets/mascots/knizhulyk-green-v1.png', 'src/host/bookyJourneyHost.ts']);

const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {}, earlierAttempts = [];
let sourceManifest, manifestFiles;
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  assert.equal(report.runtimeWiringImplemented, true); assert.equal(report.runtimeUnchanged, false);
  noApproval(report, ['stageAccepted', 'releaseReady', 'ageAdaptiveJourneysAccepted', 'reviewedDialogueAccepted', 'childApproved']);
  const manifest = await verifyRef(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, 1598); assert.equal(report.sourceManifest.fileCount, 1598);
  assert.deepEqual(manifest.files.map(item => item.path).sort(), [...baseline.files.map(item => item.path), ...added].sort());
  await verifyInputs(manifest.files); requireInputs(manifest.files, required);
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else { sourceManifest = report.sourceManifest; manifestFiles = manifest.files; for (const input of manifest.files) await verifyGitIdentity(sourceCommit, input); }
  await verifyInputs(report.checkInputs);
  if (mode !== 'unit') assert.deepEqual(report.tests, mode === 'browser' ? { passed: 2, failed: 0, skipped: 0, flaky: 0 } : null);
  const executionFile = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionFile);
  assert.equal(execution.exitCode, 0); await verifyInputs([execution.stdout, execution.stderr]);
  const rawName = mode === 'unit' ? 'vitest.json' : mode === 'browser' ? 'playwright.json' : null;
  runs[mode] = { ...await ref(file), tests: report.tests, execution: await ref(executionFile),
    rawReport: rawName ? await ref(`${folder}/${mode}-${attempt}/${rawName}`) : null };
  for (let n = 1; n < Number(attempt.slice(1)); n++) {
    const previousAttempt = 'a' + n, oldPath = `${folder}/${mode}-${previousAttempt}/result.json`;
    let old; try { old = await read(oldPath); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await verifyRef(old.sourceManifest); if (old.sourceManifestAfter) await verifyRef(old.sourceManifestAfter);
    const oldExecutionPath = `${folder}/${mode}-${previousAttempt}/execution.json`, oldExecution = await read(oldExecutionPath);
    await verifyInputs([oldExecution.stdout, oldExecution.stderr]);
    earlierAttempts.push({ ...await ref(oldPath), mode, attempt: previousAttempt, pass: old.pass, tests: old.tests,
      sourceManifest: old.sourceManifest, execution: await ref(oldExecutionPath),
      rawReport: rawName ? await optionalRef(`${folder}/${mode}-${previousAttempt}/${rawName}`) : null,
      reason: 'Original attempt retained unchanged. Only the selected final matching source supports this checkpoint.' });
  }
}
const units = await read(`${folder}/unit-${unitAttempt}/vitest.json`), cases = units.testResults.flatMap(item => item.assertionResults);
assert.deepEqual(units.testResults.map(item => normalized(item.name)).sort(), entry.unitFiles.map(normalized).sort());
assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.deepEqual([units.numPassedTests, units.numFailedTests, units.numPendingTests], [cases.length, 0, 0]);
assert.deepEqual(runs.unit.tests, { passed: cases.length, failed: 0, skipped: 0 });

const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [2, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const walk = suite => {
  for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); }
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of browser.suites) walk(suite);
assert.equal(specs.length, 2); for (const spec of specs) assert.equal(path.basename(spec.file.replaceAll('\\', '/')), 'booky-reader-policy.spec.mjs');
const copies = attachments.filter(item => item.name === 'booky-reader-policy-source-evidence' && item.path); assert.equal(copies.length, 2);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'booky-reader-policy.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 2); originals.sort();
const contracts = {
  'explicit-reader-policy': ['explicitPolicyOnly', 'unsavedDraftDoesNotGrantPolicy', 'localeDraftRetained', 'lifecycleRechecksPolicy', 'explicitDeleteConfirmed',
    'failedSaveDraftRetained', 'editedFailureRequiresExplicitSave', 'collectionDraftRetained', 'transientDeleteConfirmation'],
  'future-profile-delete-recovery': ['futureRecordPreserved', 'failedDeleteDoesNotGrantPolicy', 'explicitDeleteRetryConfirmed', 'failedDeleteIntentRetained'],
};
const scenarioImages = {
  'explicit-reader-policy': ['reader-profile-saved-ru.png', 'reader-profile-draft-narrow-en.png'],
  'future-profile-delete-recovery': ['reader-profile-delete-failed-en.png'],
};
const actualAppCaptures = [], browserAttachments = [], apps = [], images = [], validatedBehavior = {};
for (const original of originals) {
  const app = await read(original), capture = await ref(original);
  const matches = copies.filter(item => normalized(item.path).startsWith(normalized(path.dirname(original)) + '/attachments/'));
  assert.equal(matches.length, 1); const attachment = await ref(matches[0].path);
  assert.ok((await fs.readFile(original)).equals(await fs.readFile(attachment.path)));
  actualAppCaptures.push(capture); browserAttachments.push(attachment); apps.push(app);
  for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true, key);
  assert.ok(Object.hasOwn(contracts, app.scenario));
  for (const key of ['canonicalSceneRetained', 'noNewDialogueOrJourneyEnabled', ...contracts[app.scenario]]) {
    assert.equal(app[key], true, key); validatedBehavior[key] = true;
  }
  noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
    'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
  for (const key of ['errors', 'externalRequests', 'missingResources', 'customizationWrites', 'unexpectedPreferenceWrites']) assert.deepEqual(app[key], []);
  assert.equal(app.finalReaderPreference, null);
  assert.deepEqual(JSON.parse(app.finalBookyPreferenceRaw), app.finalBookyPreference);
  assert.deepEqual(app.finalBookyPreference.progress, JSON.parse(app.initialBookyPreferenceRaw).progress);
  await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs, browserRequired);
  for (const input of app.sourceInputs) assert.ok(manifestFiles.some(item => item.path === input.path && item.sha256 === input.sha256), input.path);
  const policyOperations = app.preferenceOperations.filter(item => item.key === 'probpera-booky-reader-policy-v1');
  assert.ok(policyOperations.filter(item => item.operation === 'get').length >= 2);
  const policyWrites = policyOperations.filter(item => item.operation === 'set');
  if (app.scenario === 'explicit-reader-policy') {
    assert.ok(policyWrites.length >= 1); assert.ok(policyOperations.some(item => item.operation === 'remove'));
    const saved = app.observations.savedRu, policy = saved.policy;
    assert.ok(policyWrites.some(item => json(JSON.parse(item.value)) === json(policy)));
    assert.equal(policy.schemaVersion, 1); assert.equal(policy.audience, 'adult');
    assert.equal(policy.age, 30); assert.equal(policy.readingLevel, 'plain'); assert.equal(policy.revision, 1);
    assert.equal(new Date(policy.confirmedAt).toISOString(), policy.confirmedAt);
    assert.equal(app.observations.failedSaveReopened.age, '30'); assert.equal(app.observations.failedSaveReopened.policy, null);
    assert.equal(app.observations.editedFailureReopened.age, '41'); assert.equal(app.observations.editedFailureReopened.policy, null);
    assert.equal(saved.globe.sameScene, true); assert.equal(saved.globe.contextLost, false); assert.equal(saved.globe.uploaded, true);
    const latestTargets = new Map(app.observations.narrowTargets.map(item => [item.selector, item]));
    for (const selector of ['[data-booky-reader-age]', '[data-booky-reader-level]', '[data-booky-reader-save]', '[data-booky-reader-clear]']) {
      const target = latestTargets.get(selector); assert.ok(target, selector);
      assert.equal(target.viewport, 320); assert.equal(target.reachable, true); assert.equal(target.overflow, false);
      assert.ok(target.height >= 44 && target.left >= 0 && target.right <= target.viewport);
    }
    validatedBehavior.narrowReaderTargetsReachable = true;
  } else {
    assert.deepEqual(policyWrites, []); assert.equal(policyOperations.filter(item => item.operation === 'remove').length, 2);
    assert.equal(app.observations.failedDeleteReopened.policy, null); assert.equal(app.observations.failedDeleteReopened.retry, 'Try deleting again');
  }
  assert.equal(app.fallbackArtwork.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
  assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.fallbackArtwork.bundledPath && item.sha256 === app.fallbackArtwork.sha256));
  assert.deepEqual(app.screenshots.map(item => item.filename), scenarioImages[app.scenario]);
  for (const image of app.screenshots) {
    assert.match(image.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(image.framing?.trim());
    if (image.filename === 'reader-profile-draft-narrow-en.png') assert.deepEqual([image.width, image.height], [320, 850]);
    images.push({ path: path.join(path.dirname(original), image.filename), sha256: image.sha256 });
  }
}
assert.deepEqual(apps.map(app => app.scenario).sort(), Object.keys(contracts).sort()); assert.equal(images.length, 3); await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
const captureRefs = refs => refs.map(item => ({ path: normalized(item.path), sha256: item.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(captureRefs(visual.actualAppCaptures), captureRefs(actualAppCaptures)); noApproval(visual, ['artAccepted', 'childApproved', 'releaseReady']);
assert.equal(visual.images.length, 3); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, 3);
for (const image of visual.images) {
  assert.equal(image.inspected, true); assert.ok(typeof image.reviewer === 'string' && image.reviewer.trim());
  assert.ok(Array.isArray(image.findings) && image.findings.length && image.findings.every(item => typeof item === 'string' && item.trim()));
  assert.ok(images.some(known => normalized(known.path) === normalized(image.path) && known.sha256 === image.sha256)); await verifyInputs([image]);
}

const pwaPath = `${folder}/pwa-${pwaAttempt}/result.json`, androidPath = `${folder}/android-${androidAttempt}/result.json`;
const pwa = await read(pwaPath), android = await read(androidPath);
for (const record of [pwa, android]) {
  assert.equal(record.pass, true); assert.equal(record.sourceCommit, sourceCommit); assert.match(record.buildId, /^[a-f0-9]{64}$/u);
  noApproval(record, ['stageAccepted', 'releaseReady', 'productionActionsPerformed']); assert.ok(normalized(record.artifact.path).startsWith(artifacts + '/'));
  const manifest = await verifyRef({ path: record.artifact.path + '/artifact.json', sha256: record.artifact.artifactSha256 ?? record.artifact.sha256 });
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(manifest.buildId, record.buildId); assert.equal(manifest.sourceInputs.sha256, record.sourceInputsSha256);
  await verifyInputs(manifest.sourceInputs.files); requireInputs(manifest.sourceInputs.files, runtimeRequired);
  for (const input of manifest.sourceInputs.files) await verifyGitIdentity(sourceCommit, input);
  for (const file of runtimeRequired) assert.ok(manifest.sourceInputs.files.some(item => item.path === file && manifestFiles.some(source => source.path === file && source.sha256 === item.sha256)));
  for (const item of manifest.inventory) { const bytes = await fs.readFile(path.join(record.artifact.path, item.path)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, item.path); }
  const fallback = manifest.inventory.filter(item => item.sha256 === apps[0].fallbackArtwork.sha256 && item.bytes === apps[0].fallbackArtwork.bytes && item.path.endsWith('.png'));
  assert.equal(fallback.length, 1);
}
assert.equal(pwa.artifact.exactCopiesVerified, true); assert.equal(android.checks.exactCopiedBytes, true);
assert.deepEqual([pwa.browser.expected, pwa.browser.unexpected, pwa.browser.skipped, pwa.browser.flaky], [1, 0, 0, 0]);
assert.equal(pwa.localQaAuthority, true); assert.equal(pwa.installedDevice, false); assert.equal(android.nativeExecutionVerified, false); assert.equal(android.iosCompiled, false);
const pwaBrowser = await read(`${folder}/pwa-${pwaAttempt}/playwright.json`);
assert.deepEqual([pwaBrowser.stats.expected, pwaBrowser.stats.unexpected, pwaBrowser.stats.skipped, pwaBrowser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(pwaBrowser.errors, []);
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
const helperSuffix = attempt => attempt === 'a1' ? '' : '-' + attempt;
const pwaSuffix = helperSuffix(pwaAttempt), androidSuffix = helperSuffix(androidAttempt);
const selectedBuildHelpers = { pwa: `build-pwa${pwaSuffix}.mjs`, pwaConfig: `pwa${pwaSuffix}.config.mjs`,
  android: `build-android${androidSuffix}.ps1`, androidVerification: `verify-android${androidSuffix}.mjs`,
  androidPreservation: `preserve-android${androidSuffix}.mjs` };
const buildHelpers = await Promise.all(Object.values(selectedBuildHelpers).map(file => ref(folder + '/' + file)));
const retainedBuilds = [];
for (const [kind, expectedRef] of [['pwa', entry.priorPwa], ['android', entry.priorAndroid]]) {
  const reference = priorRuntime[kind]; assert.equal(reference.path, expectedRef.path); assert.equal(reference.sha256, expectedRef.sha256);
  const old = await verifyRef(reference); assert.equal(old.pass, true); assert.equal(old.sourceCommit, expectedRef.sourceCommit); assert.equal(old.buildId, expectedRef.buildId);
  const artifactManifest = { path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 };
  const manifest = await verifyRef(artifactManifest); assert.equal(manifest.sourceCommit, expectedRef.sourceCommit); assert.equal(manifest.buildId, expectedRef.buildId);
  if (old.apk) await verifyInputs([old.apk]);
  for (const item of manifest.inventory) { const bytes = await fs.readFile(path.join(old.artifact.path, item.path)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, item.path); }
  retainedBuilds.push({ kind, priorResult: expectedRef, artifactManifest, apk: old.apk ?? null, runtimePayloadRehashed: true,
    sourceCommit: old.sourceCommit, buildId: old.buildId, readerPolicyIntegrationIncluded: false });
}
// Earlier builds may include the initial implementation before a subsequently
// fixed issue. Preserve their identities/payloads without treating them as the
// selected final source or representing them as current behavior evidence.
const intermediateBuilds = [];
for (const [kind, selected] of [['pwa', pwaAttempt], ['android', androidAttempt]]) {
  for (let n = 1; n < Number(selected.slice(1)); n++) {
    const attempt = 'a' + n, file = `${folder}/${kind}-${attempt}/result.json`, reference = await optionalRef(file);
    if (!reference) continue;
    const old = await read(file), preserved = { kind, attempt, result: reference, pass: old.pass,
      sourceCommit: old.sourceCommit, buildId: old.buildId ?? null, finalValidation: false };
    assert.match(old.sourceCommit, /^[a-f0-9]{40}$/u);
    git(['merge-base', '--is-ancestor', old.sourceCommit, sourceCommit]);
    noApproval(old, ['stageAccepted', 'releaseReady', 'productionActionsPerformed']);
    if (old.pass === true) {
      assert.ok(normalized(old.artifact.path).startsWith(artifacts + '/'));
      const artifactManifest = { path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 };
      const manifest = await verifyRef(artifactManifest);
      assert.equal(manifest.sourceCommit, old.sourceCommit); assert.equal(manifest.buildId, old.buildId);
      for (const item of manifest.inventory) {
        const bytes = await fs.readFile(path.join(old.artifact.path, item.path)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, item.path);
      }
      if (old.apk) await verifyInputs([old.apk]);
      Object.assign(preserved, { artifactManifest, apk: old.apk ?? null, runtimePayloadRehashed: true });
    }
    intermediateBuilds.push(preserved);
  }
}
const buildBaselines = [];
for (const attempt of new Set([pwaAttempt, androidAttempt].filter(value => value !== 'a1'))) {
  const reference = await ref(`${folder}/build-baseline-${attempt}.json`), baseline = await verifyRef(reference);
  assert.equal(baseline.schemaVersion, 1); assert.equal(baseline.checkpoint, entry.checkpoint);
  for (const [kind, selected] of [['pwa', pwaAttempt], ['android', androidAttempt]]) {
    if (selected !== attempt) continue;
    const prior = baseline[kind === 'pwa' ? 'priorPwa' : 'priorAndroid'];
    const previousAttempt = 'a' + (Number(attempt.slice(1)) - 1);
    assert.equal(prior.path, `${folder}/${kind}-${previousAttempt}/result.json`);
    const preserved = intermediateBuilds.find(item => item.kind === kind && item.attempt === previousAttempt);
    assert.ok(preserved); assert.equal(preserved.pass, true); assert.equal(preserved.result.sha256, prior.sha256);
    assert.equal(preserved.sourceCommit, prior.sourceCommit); assert.equal(preserved.buildId, prior.buildId);
  }
  buildBaselines.push(reference);
}
// Preserve the historical starter-set audit while identifying all changed
// inputs. Reader-profile checks cannot newly accept models or artwork.
const inventory = await verifyRef(priorRuntime.starterSetSourceInventory), inventoryChangedInputs = [];
assert.equal(inventory.auditValid, true); assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 13, 0, 3]);
const inherited = new Map(priorRuntime.inventoryChangedInputs.map(item => [item.path, item]));
for (const item of inventory.sourceInputs) {
  const current = await ref(item.path), old = inherited.get(item.path);
  if (!changed.includes(item.path)) assert.equal(current.sha256, old?.currentSha256 ?? item.sha256, item.path);
  if (current.sha256 !== item.sha256) inventoryChangedInputs.push({ path: item.path, priorSha256: item.sha256, currentSha256: current.sha256 });
}

const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md',
  'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/REQUIREMENTS_TRACEABILITY.json', 'docs/mobile/REQUIREMENTS_TRACEABILITY.csv'];
const originalsDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalsDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S15');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const beforeStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 }); assert.equal(state.headSha, prior.sourceCommit);
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance'); assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance');
assert.equal(stage.status, 'IN_PROGRESS'); assert.equal(state.verificationCache.s15BookyJourneyHost.path, entry.previous);
await verifyRef(state.verificationCache.s15BookyJourneyHost); assert.equal(state.verificationCache.s15BookyReaderPolicy, undefined);
const affectedIds = ['PLANETKA-004'], trace = JSON.parse(originalsDocs.get(globalFiles[5])), priorTrace = structuredClone(trace);
assert.deepEqual(entry.requirements, affectedIds);
for (const id of affectedIds) { assert.equal(stage.criteria.find(item => item.id === 'S15.' + id).status, 'IN_PROGRESS'); assert.equal(trace.requirements.find(item => item.id === id).status, 'IN_PROGRESS'); }
const decisions = originalsDocs.get(globalFiles[1]), marker = '<!-- s15-reader-policy-integration-20260923:begin -->';
assert.equal([...decisions.matchAll(/^- D161:/gmu)].length, 1); assert.equal(/^- D162:/mu.test(decisions), false);
for (const file of globalFiles.slice(2, 5)) assert.equal(originalsDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue S15 with guarded reviewed-dialogue and journey integration using the explicit local adult reader policy and fresh immutable host sources. Re-resolve admission on each interaction; unknown, pending, failed, cleared, invalid or unsupported policy stays unavailable. Keep all 34 RU/EN dialogue inventory records draft and require independent exact-version review receipts before enabling production routes. Preserve canonical scene ownership, catalog readiness, ordinary adult navigation, semantic progress, explicit resume/reset and offline recovery. Child profiles, approved text/audio, full journeys, accessibility, installed-device/performance, iOS and release acceptance remain pending; S03.acceptance is first unresolved.';
const limitations = [
  'The profile is optional explicit local adult input, not age assurance, a child profile, content approval, reading progress or an entitlement. No age or reading level is inferred from adult access, locale or behaviour.',
  'The actual App wires policy storage, RU/EN settings and nullable confirmed policy into the existing companion. The actual companion invokes the journey-host resolver through fresh source callbacks; synthetic unit fixtures are the only reviewed-route admission data.',
  'The two actual-App Chrome cases exercise controlled native preference bindings, invalid-age rejection, confirmed save, unsaved draft and locale separation, background/restart rereads, explicit clear, future-format preservation and removal-failure recovery. They do not execute a production reviewed journey or a standalone Web-profile browser case.',
  'App-owned draft and pending save/delete intent survive companion collapse, the globe/collection transition and background suspension without authorizing unsaved input. Editing after a failed save requires a new explicit save. The deletion-confirmation prompt is local to the mounted form and closes on remount; only a new confirmation or an explicit failed-delete retry can request removal.',
  'Strict Web and native preference IO, readback failures, serial writes, deadlines, lifecycle and admission races are unit evidence. Successful port readback confirms observed storage state, not durable disk persistence.',
  'The 320px checks establish scroll-reachable reader controls and no horizontal overflow, not that every form field is simultaneously visible. Scene identity and recorded appearance remain unchanged; camera pose and route identity are not asserted across all interactions.',
  'Fresh preserved PWA and Android-dev artifacts bind this source. The built-PWA browser case is the existing offline/download smoke; Android APK/build audits are local byte evidence, not installed-device execution. iOS is not compiled.',
  'Prior PWA/Android artifacts remain preserved and rehashed against their original manifests; they do not contain this reader-policy integration. The starter-set source inventory remains a historical audit with explicit changed-input hashes.',
  'All 34 inventoried RU/EN dialogue records remain draft. No production journey, reviewed dialogue, narration, child access, age-adaptive journey acceptance or new content approval is introduced.',
  'Visual review covers the three preserved screenshots only. It is not formal art, accessibility, installed-device/performance, stage or release acceptance.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_READER_POLICY_INTEGRATION_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: entry.previousCheckpointResult, previousRuntime: prior.previousRuntime,
  checkpointHelper: await ref(folder + '/checkpoint.mjs'), attempts: { ...attempts, pwa: pwaAttempt, android: androidAttempt },
  earlierAttempts, runs, sourceManifest, sourceCommits, unitFiles: entry.unitFiles, unitReport: runs.unit.rawReport, unitCount: cases.length, unitRerun: true,
  browserCases: 2, actualAppCaptures, browserAttachments, attachmentBytesMatchOriginal: true, validatedBehavior,
  visualReview: await ref(visualPath), inspectedImageCount: 3, unchangedTrackedInputCount: protectedFiles.length, protectedInputsVerified: true,
  changedSourcePaths: changed, newSourcePaths: added, newImplementationFiles: added, gitIdentityDifferences: [...gitIdentityDifferences.values()],
  starterSetSourceInventory: priorRuntime.starterSetSourceInventory, inventoryHistorical: true, inventoryAuditRerun: false, inventoryChangedInputs,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, buildHelpers, buildBaselines, exactFreshArtifactInputsVerifiedAgainstSourceCommit: true,
  copyVerification: await ref(copyPath), pwaBrowserReport: await ref(folder + '/pwa-' + pwaAttempt + '/playwright.json'),
  priorPwa: entry.priorPwa, priorAndroid: entry.priorAndroid, retainedBuilds, intermediateBuilds,
  buildsRebuilt: true, browserRerun: true, decisionD162Recorded: true,
  criteriaUpdated: affectedIds.map(id => 'S15.' + id), criterionChanges: [], requirementChanges: [], stageChanges: [], counts,
  allStageAndCriterionStatusesUnchanged: true, firstUnresolved: 'S03.acceptance', limitations, nextAction,
  actualApp: true, actualCss: true, actualGlobe: true, runtimeWiringImplemented: true, explicitLocalAdultPolicy: true,
  currentCatalogReadinessRequired: true, ordinaryAdultNavigationPreserved: true, canonicalSceneRetained: true,
  productionJourneysEnabled: false, reviewedDialogueAccepted: false, narrationEnabled: false, childApproved: false,
  childProfileCreated: false, childAccessGranted: false, ageAdaptiveJourneysAccepted: false, fullJourneyMigrationAccepted: false,
  installedNativeDevice: false, builtPwaReaderPolicyExecution: false, artChanged: false, globeSceneChanged: false,
  artAccepted: false, screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false,
  grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
const scopedNote = ' The actual App now supports optional explicit local adult age/reading-level settings, authoritative native/Web preference confirmation and nullable policy in the existing companion. App-owned drafts and failed save/delete intent survive collapse, collection transitions and background suspension; deletion confirmation stays local to the form. Its journey admission rechecks current host/source identity; no production route or content approval is supplied. ' + cases.length + ' focused unit tests, TypeScript, 2 actual-App Chrome cases and 3 inspected images bind fresh preserved PWA/Android-dev builds. All 1,583 protected prior implementation/test inputs remain exact. No stage, child, reviewed-content or release acceptance is claimed.';
for (const id of affectedIds) {
  const criterion = stage.criteria.find(item => item.id === 'S15.' + id), requirement = trace.requirements.find(item => item.id === id);
  criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += scopedNote; push(criterion.evidence, resultPath);
  requirement.commit = sourceCommit; requirement.notes += scopedNote; push(requirement.evidence, resultPath);
  for (const file of runtimeRequired) push(requirement.implementationFiles, file);
  for (const file of [...entry.unitFiles, 'tests/pwa/booky-reader-policy.spec.mjs']) push(requirement.tests, file);
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, 'node ' + folder + '/check.mjs ' + mode + ' ' + attempt);
for (const command of ['node ' + folder + '/' + selectedBuildHelpers.pwa + ' ' + sourceCommit,
  'pwsh -File ' + folder + '/' + selectedBuildHelpers.android + ' ' + sourceCommit,
  'node ' + folder + '/' + selectedBuildHelpers.androidPreservation + ' ' + sourceCommit]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 explicit local adult reader policy is wired into actual App settings/storage and the companion admission boundary. Saved policy alone can supply age/reading level; drafts, unknown/failing storage, future records and clear never grant admission. Production journeys and review approvals remain absent; no stage or release acceptance.');
state.verificationCache.s15BookyReaderPolicy = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
assert.deepEqual(trace.requirements.filter(item => !affectedIds.includes(item.id)), priorTrace.requirements.filter(item => !affectedIds.includes(item.id)));
assert.deepEqual(trace.requirements.map(item => [item.id, item.status]), priorTrace.requirements.map(item => [item.id, item.status]));
const sourceRows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originalsDocs.get(globalFiles[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(priorTrace, sourceRows));
const decision = '\n- D162: Source ' + sourceCommit + scopedNote + ' Fresh PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + ' are local build evidence; built-PWA coverage is the offline/download smoke and no installed-device run is claimed. PLANETKA-004 and every stage/criterion status remain unchanged, with S03.acceptance first unresolved. Evidence: evidence/S15/reader-policy-integration-20260923/result.json.\n';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ':' + scopedNote + '\nFresh PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + '; built-PWA coverage is offline/download smoke, not reader-profile runtime acceptance.\nPLANETKA-004 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/reader-policy-integration-20260923/result.json.\n' + nextAction + '\n<!-- s15-reader-policy-integration-20260923:end -->\n\n';
const readme = '# S15 explicit local adult reader policy integration\n\nSource: ' + sourceCommit + '.\n\n' + scopedNote.trim() + '\n\n' + limitations.map(item => '- ' + item).join('\n') + '\n\nNext: ' + nextAction + '\n';
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision],
  ...globalFiles.slice(2, 5).map(file => [file, note + originalsDocs.get(file)]),
  [globalFiles[5], json(trace)], [globalFiles[6], projectTraceabilityCsv(trace, sourceRows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalsDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(readmePath, readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount: cases.length, browserCases: 2, inspectedImages: 3,
  sourceInputs: manifestFiles.length, protectedInputs: protectedFiles.length, counts, criterionChanges: [],
  firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
