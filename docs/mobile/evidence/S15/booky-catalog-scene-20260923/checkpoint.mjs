import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Execute only after the exact source commit, selected final checks, actual
// visual inspection and fresh preserved PWA/Android builds. No tests run here.
const [sourceCommit, browserAttempt, staticAttempt, pwaAttempt = 'a1', androidAttempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [browserAttempt, staticAttempt, pwaAttempt, androidAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/booky-catalog-scene-20260923';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-catalog-scene';
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const gitIdentityDifferences = new Map();
const verifiedCommittedInputs = new Set();
const utf8TextExtensions = new Set(['.bat', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.txt', '.csv', '.svg', '.geojson']);
async function verifyGitIdentity(commit, input) {
  const identityKey = commit + ':' + input.path + ':' + input.sha256;
  if (verifiedCommittedInputs.has(identityKey)) return;
  const blob = gitBytes(['show', commit + ':' + input.path]), gitBlobSha256 = sha(blob);
  if (gitBlobSha256 === input.sha256) { verifiedCommittedInputs.add(identityKey); return; }
  assert.ok(utf8TextExtensions.has(path.extname(input.path)), 'Non-text Git identity differs: ' + input.path);
  const checkedOut = await fs.readFile(input.path);
  assert.equal(sha(checkedOut), input.sha256, input.path);
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
    'tests/pwa/booky-catalog-scene.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
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
const entry = await read(folder + '/entry.json'), changed = entry.changedInputsBefore.map(item => item.path), added = entry.newSourcePaths;
const required = [...changed, ...added];
assert.deepEqual(entry.unitFiles, []); assert.equal(entry.unitRerunPlanned, false);
const runtimeRequired = required.filter(file => file.startsWith('src/') && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file));
assert.deepEqual(runtimeRequired.slice().sort(), ['src/App.tsx', 'src/components/LiteraryWorldMap.tsx', 'src/index.css']);
assert.ok(added.includes('tests/pwa/booky-catalog-scene.spec.mjs'));
assert.equal(entry.stage, 'S15'); assert.equal(entry.expectedBrowserTests, 3); noApproval(entry);
assert.equal(entry.childApproved, false); assert.match(entry.checkpoint, /^[a-f0-9]{40}$/u);
assert.notEqual(sourceCommit, entry.checkpoint); git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]); cleanSource();
assert.equal(entry.previousCheckpointResult.path, entry.previous);
const prior = await verifyRef(entry.previousCheckpointResult); assert.equal(prior.pass, true); noApproval(prior);
assert.deepEqual(entry.priorSourceManifest, prior.sourceManifest);
const baseline = await verifyRef(entry.priorSourceManifest); assert.equal(baseline.files.length, entry.priorSourceManifest.fileCount);
const priorRuntime = await read(entry.previousRuntime); assert.equal(priorRuntime.pass, true); noApproval(priorRuntime);
assert.equal(entry.previousRuntime, entry.previous); assert.deepEqual(priorRuntime, prior);
await verifyInputs(entry.preservedInputs); assert.equal(entry.preservedInputs.length, 83);
await verifyInputs(entry.checkpointFiles);
await verifyInputs(entry.protectedFiles); assert.equal(entry.protectedFiles.length, 1584);
assert.deepEqual(entry.protectedFiles.map(item => item.path).sort(), baseline.files.map(item => item.path).filter(file => !changed.includes(file)).sort());
for (const item of entry.protectedFiles) assert.ok(baseline.files.some(old => old.path === item.path && old.sha256 === item.sha256));
for (const item of entry.changedInputsBefore) {
  assert.equal(item.sourceCommit, entry.checkpoint);
  assert.equal(sha(gitBytes(['show', entry.checkpoint + ':' + item.path])), item.gitBlobSha256, item.path);
  assert.ok(baseline.files.some(old => old.path === item.path && old.sha256 === item.sha256));
}
assert.deepEqual(git(['diff', '--name-only', entry.checkpoint, sourceCommit, '--', 'src', 'scripts/mobile', 'tests/pwa']).split(/\r?\n/u).filter(Boolean).sort(), required.slice().sort());
requireInputs([...entry.preservedInputs, ...entry.protectedFiles], ['src/components/GlobeCameraRig.tsx', 'src/components/LiteraryGlobe.tsx',
  'src/host/planetMascot.ts', 'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts',
  'src/assets/mascots/knizhulyk-green-v1.png']);

// Historical unit evidence is preserved and verified, never represented as a new run.
assert.deepEqual(entry.priorUnitEvidence, prior.runs.unit);
const priorUnits = await verifyRef(entry.priorUnitEvidence);
assert.equal(priorUnits.pass, true); assert.deepEqual(priorUnits.tests, { passed: 265, failed: 0, skipped: 0 });
assert.deepEqual(priorUnits.sourceManifest, entry.priorSourceManifest); noApproval(priorUnits);
const priorUnitExecution = await verifyRef(entry.priorUnitEvidence.execution);
assert.equal(priorUnitExecution.exitCode, 0); await verifyInputs([priorUnitExecution.stdout, priorUnitExecution.stderr]);
const unitRaw = await verifyRef(entry.priorUnitEvidence.rawReport), unitCases = unitRaw.testResults.flatMap(item => item.assertionResults);
assert.equal(unitCases.length, 265); assert.ok(unitCases.every(item => item.status === 'passed'));
assert.deepEqual([unitRaw.numPassedTests, unitRaw.numFailedTests, unitRaw.numPendingTests], [265, 0, 0]);
requireInputs(entry.protectedFiles, prior.unitFiles); const retainedUnitCount = 265;
const attempts = { static: staticAttempt, browser: browserAttempt }, runs = {}, earlierAttempts = [];
let sourceManifest, manifestFiles;
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0); noApproval(report);
  const manifest = await verifyRef(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, report.sourceManifest.fileCount); await verifyInputs(manifest.files); requireInputs(manifest.files, required);
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else { sourceManifest = report.sourceManifest; manifestFiles = manifest.files; for (const input of manifest.files) await verifyGitIdentity(sourceCommit, input); }
  await verifyInputs(report.checkInputs);
  assert.deepEqual(report.tests, mode === 'browser' ? { passed: entry.expectedBrowserTests, failed: 0, skipped: 0, flaky: 0 } : null);
  const executionFile = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionFile);
  assert.equal(execution.exitCode, 0); await verifyInputs([execution.stdout, execution.stderr]);
  runs[mode] = { ...await ref(file), tests: report.tests, execution: await ref(executionFile),
    rawReport: mode === 'static' ? null : await ref(`${folder}/${mode}-${attempt}/playwright.json`) };
  for (let n = 1; n < Number(attempt.slice(1)); n++) {
    const previousAttempt = 'a' + n, oldPath = `${folder}/${mode}-${previousAttempt}/result.json`;
    let old; try { old = await read(oldPath); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await verifyRef(old.sourceManifest); if (old.sourceManifestAfter) await verifyRef(old.sourceManifestAfter);
    const oldExecutionPath = `${folder}/${mode}-${previousAttempt}/execution.json`, oldExecution = await read(oldExecutionPath);
    await verifyInputs([oldExecution.stdout, oldExecution.stderr]);
    earlierAttempts.push({ ...await ref(oldPath), mode, attempt: previousAttempt, pass: old.pass, tests: old.tests,
      sourceManifest: old.sourceManifest, execution: await ref(oldExecutionPath),
      rawReport: mode === 'static' ? null : await optionalRef(`${folder}/${mode}-${previousAttempt}/playwright.json`),
      reason: mode === 'browser' && previousAttempt === 'a1'
        ? 'Original behavior run passed 3 cases, but visual inspection found the bottom notice overlapping existing globe instructions and covered by Booky. It is preserved history, not final visual acceptance.'
        : mode === 'browser' && previousAttempt === 'a2'
          ? 'The expanded mobile Booky overlay intercepted the underlying globe retry during the Playwright trial click. The final fixture verifies the panel retry, explicitly closes Booky, then verifies the globe retry after stable layout samples.'
        : mode === 'browser' && previousAttempt === 'a3'
          ? 'All three behavior cases passed, but visual inspection found the mobile Appearance toggle overlapping the notice text. Final CSS reserves its vertical space and the geometry check also includes the appearance controls.'
        : 'Original attempt retained unchanged. Only the selected final matching source supports this checkpoint.' });
  }
}

const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [3, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const walk = suite => {
  for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); }
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of browser.suites) walk(suite);
assert.equal(specs.length, 3); for (const spec of specs) assert.equal(path.basename(spec.file.replaceAll('\\', '/')), 'booky-catalog-scene.spec.mjs');
const copies = attachments.filter(item => item.name === 'booky-catalog-scene-source-evidence' && item.path); assert.equal(copies.length, 3);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'booky-catalog-scene.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 3); originals.sort();
const contracts = {
  'retained-selection-failed-catalog': ['realHistoryRetry', 'loadingSuspendsSelectedProgress', 'pendingReloadDoesNotAcknowledge', 'failedReloadSuspendsSelectedProgress', 'canonicalSceneRetained'],
  'retained-selection-recovered-catalog': ['realHistoryRetry', 'loadingSuspendsSelectedProgress', 'pendingReloadDoesNotAcknowledge', 'recoveredReadyRestoresActions', 'offlineReadyAllowsSelectedProgress', 'canonicalSceneRetained'],
  'initial-catalog-failure': ['initialFailureHasNoScene'],
};
const common = ['noAppearanceWrites', 'noNewDialogueOrJourneyEnabled'];
const scenarioObservations = {
  'retained-selection-failed-catalog': ['beforeRetry', 'loadingWriterStep', 'failedWriterStep', 'failedHelp'],
  'retained-selection-recovered-catalog': ['beforeRetry', 'loadingWriterStep', 'offlineReadyWriterStep', 'recoveredHelpEn'],
  'initial-catalog-failure': ['initialFailure'],
};
const scenarioImages = {
  'retained-selection-failed-catalog': ['booky-catalog-failed-ru.png', 'booky-catalog-failed-narrow-ru.png'],
  'retained-selection-recovered-catalog': ['booky-catalog-recovered-offline-en.png'],
  'initial-catalog-failure': ['catalog-initial-failure-ru.png'],
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
  for (const key of [...common, ...contracts[app.scenario]]) { assert.equal(app[key], true, key); validatedBehavior[key] = true; }
  noApproval(app, ['installedNative', 'deviceTested', 'devicePerformanceAccepted', 'childReviewed', 'childProfileCreated',
    'childAccessGranted', 'reviewedDialogueAccepted', 'narrationEnabled', 'artAccepted', 'releaseReady']);
  for (const key of ['errors', 'externalRequests', 'missingResources', 'customizationWrites', 'unexpectedPreferenceWrites']) assert.deepEqual(app[key], []);
  const initialFailure = app.scenario === 'initial-catalog-failure';
  if (initialFailure) {
    assert.deepEqual(app.countryRequests, [app.primaryCountryChunk]);
    assert.ok(app.controlledFailures.some(item => item.path === app.primaryCountryChunk && item.status === 503));
    assert.ok(app.controlledFailures.every(item => [app.primaryCountryChunk, app.primaryBookChunk].includes(item.path) && item.status === 503));
    assert.equal(app.observations.initialFailure.globe, null);
    assert.deepEqual(app.bookyWrites, []); assert.equal(app.finalBookyPreferenceRaw, app.initialBookyPreferenceRaw);
  } else {
    assert.deepEqual(app.countryRequests, [app.primaryCountryChunk, app.retryCountryChunk]);
    assert.deepEqual(app.controlledFailures, [{ path: app.primaryBookChunk, status: 503 },
      ...(app.scenario === 'retained-selection-failed-catalog' ? [{ path: app.retryCountryChunk, status: 503 }] : [])]);
  }
  await verifyInputs(app.sourceInputs); requireInputs(app.sourceInputs, runtimeRequired);
  for (const input of app.sourceInputs.filter(item => runtimeRequired.includes(item.path))) assert.ok(manifestFiles.some(item => item.path === input.path && item.sha256 === input.sha256));
  for (const key of scenarioObservations[app.scenario]) assert.ok(app.observations?.[key] && typeof app.observations[key] === 'object');
  if (!initialFailure) {
  const progress = [{ route: 'country-to-book', routeVersion: 1, acknowledgedStepIds: ['choose-country'] }];
  const before = app.observations.beforeRetry, loading = app.observations.loadingWriterStep;
  assert.equal(before.nextEnabled, true); assert.equal(before.writerActionEnabled, true); assert.deepEqual(before.preference.progress, progress);
  assert.equal(loading.support, 'countries-loading'); assert.equal(loading.nextEnabled, false); assert.equal(loading.writerActionEnabled, false);
  assert.deepEqual(loading.preference.progress, progress);
  assert.deepEqual(JSON.parse(app.finalBookyPreferenceRaw), app.finalBookyPreference);
  const final = app.scenario === 'retained-selection-failed-catalog' ? app.observations.failedWriterStep : app.observations.offlineReadyWriterStep;
  const recovered = app.scenario === 'retained-selection-recovered-catalog';
  assert.equal(final.support, recovered ? 'offline' : 'countries-error');
  assert.equal(final.nextEnabled, recovered); assert.equal(final.writerActionEnabled, recovered); assert.deepEqual(final.preference.progress, progress);
  assert.deepEqual(app.finalBookyPreference.progress, recovered
    ? [{ ...progress[0], acknowledgedStepIds: ['choose-country', 'choose-writer'] }] : progress);
  const originalGlobe = before.globe;
  assert.equal(originalGlobe.sameScene, true);
  for (const observation of scenarioObservations[app.scenario]) {
    const globe = app.observations[observation].globe;
    assert.ok(globe); assert.equal(globe.sameScene, true); assert.equal(globe.contextLost, false); assert.equal(globe.uploaded, true);
    for (const key of ['texture', 'geometry', 'backgroundResource', 'selection']) assert.deepEqual(globe[key], originalGlobe[key], observation + ':' + key);
  }
  }
  assert.equal(app.fallbackArtwork.sha256, '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed');
  assert.ok(app.builtFiles.some(item => '/fixture/' + item.path === app.fallbackArtwork.bundledPath && item.sha256 === app.fallbackArtwork.sha256));
  if (app.scenario === 'retained-selection-failed-catalog') {
    assert.equal(app.mobilePanelRetryReachable, true);
    for (const name of ['noticeDesktop', 'noticeNarrow']) {
      const layout = app.observations[name]; assert.ok(layout, name);
      assert.deepEqual(layout.collisions, []); assert.equal(layout.retryReachable, true); assert.equal(layout.overflow, false);
      assert.ok(Number.isFinite(layout.width) && layout.width > 0 && Number.isFinite(layout.height) && layout.height > 0);
      const { rectangle, button } = layout;
      assert.ok(rectangle.left >= 0 && rectangle.right <= layout.width && rectangle.top >= 0 && rectangle.bottom <= layout.height);
      assert.ok(button.height >= 44 && button.width > 0);
      if (name === 'noticeNarrow') assert.deepEqual([layout.width, layout.height], [320, 850]);
    }
    validatedBehavior.noticeDesktopAndNarrowGeometry = true;
    validatedBehavior.retryTrialActionable = true;
    validatedBehavior.mobilePanelRetryReachable = true;
  }
  assert.deepEqual(app.screenshots.map(item => item.filename), scenarioImages[app.scenario]);
  const narrowImage = app.screenshots.find(item => item.filename === 'booky-catalog-failed-narrow-ru.png');
  if (narrowImage) assert.deepEqual([narrowImage.width, narrowImage.height], [320, 850]);
  for (const image of app.screenshots) {
    assert.match(image.filename, /^[A-Za-z0-9_-]+\.png$/u); assert.ok(image.framing?.trim());
    images.push({ path: path.join(path.dirname(original), image.filename), sha256: image.sha256 });
  }
}
assert.deepEqual(apps.map(app => app.scenario).sort(), Object.keys(contracts).sort()); assert.equal(images.length, 4); await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.pass, true); assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
const captureRefs = refs => refs.map(item => ({ path: normalized(item.path), sha256: item.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(captureRefs(visual.actualAppCaptures), captureRefs(actualAppCaptures)); noApproval(visual, ['artAccepted', 'childApproved', 'releaseReady']);
assert.equal(visual.images.length, images.length); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, images.length);
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
  // Bind every captured build input to this exact commit, including config,
  // shell, portrait-selection and the separately captured canonical registry.
  // A clean src/ tree alone is insufficient authority for a fresh artifact.
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
const buildHelpers = await Promise.all(['build-pwa.mjs', 'pwa.config.mjs', 'build-android.ps1', 'verify-android.mjs', 'preserve-android.mjs'].map(file => ref(folder + '/' + file)));
for (const [reference, expectedRef] of [[priorRuntime.pwa, entry.priorPwa], [priorRuntime.android, entry.priorAndroid]]) {
  assert.equal(reference.path, expectedRef.path); assert.equal(reference.sha256, expectedRef.sha256);
  const old = await verifyRef(reference); assert.equal(old.pass, true); assert.equal(old.sourceCommit, expectedRef.sourceCommit); assert.equal(old.buildId, expectedRef.buildId);
  const manifest = await verifyRef({ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 });
  assert.equal(manifest.sourceCommit, expectedRef.sourceCommit); assert.equal(manifest.buildId, expectedRef.buildId);
  if (old.apk) await verifyInputs([old.apk]);
  for (const item of manifest.inventory) { const bytes = await fs.readFile(path.join(old.artifact.path, item.path)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, item.path); }
}
const inventory = await verifyRef(priorRuntime.starterSetSourceInventory), inventoryChangedInputs = [];
assert.deepEqual(entry.priorStarterSetSourceInventory, priorRuntime.starterSetSourceInventory);
assert.equal(entry.inventoryHandling, 'historical-with-explicit-changed-inputs');
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
assert.equal(stage.status, 'IN_PROGRESS'); assert.equal(state.verificationCache.s15BookyCatalogReadiness.path, entry.previous);
await verifyRef(state.verificationCache.s15BookyCatalogReadiness); assert.equal(state.verificationCache.s15BookyCatalogScene, undefined);
const affectedIds = ['PLANETKA-005'], trace = JSON.parse(originalsDocs.get(globalFiles[5])), priorTrace = structuredClone(trace);
assert.deepEqual(entry.requirements, affectedIds);
for (const id of affectedIds) { assert.equal(stage.criteria.find(item => item.id === 'S15.' + id).status, 'IN_PROGRESS'); assert.equal(trace.requirements.find(item => item.id === id).status, 'IN_PROGRESS'); }
const decisions = originalsDocs.get(globalFiles[1]), marker = '<!-- s15-catalog-scene-20260923:begin -->';
assert.equal([...decisions.matchAll(/^- D159:/gmu)].length, 1); assert.equal(/^- D160:/mu.test(decisions), false);
for (const file of globalFiles.slice(2, 5)) assert.equal(originalsDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue S15 with guarded integration of reviewed Booky dialogue and literary journeys under explicit current host policy. Keep the 34 inventoried RU/EN records draft and unavailable as reviewed content. Preserve the application globe across catalog retry, truthful readiness and retry states, adult semantic progress, deliberate resume/reset, unsupported-save protection, offline recovery and canonical scene ownership. Child profiles, approved text/audio, full journeys, accessibility, installed-device/performance, iOS and release gates remain pending. S03.acceptance remains first unresolved.';
const limitations = [
  'Two actual-App Chrome reload cases preserve the same canvas, renderer, camera and scene objects and the recorded texture/geometry/appearance. Camera pose and route identity are not asserted across user navigation.',
  'The initial catalog failure case keeps the original fallback and has no rendered globe. Its inherited actualGlobe fixture metadata identifies the included canonical globe code, not a mounted scene in that case.',
  'Current catalog readiness continues to gate Booky actions and semantic acknowledgement. Retaining a scene does not authorize stale selected content; ready offline catalogs remain usable.',
  'The failed-reload notice has viewport, collision and retry-hit evidence on desktop and at 320 x 850. On mobile the fixture first checks the expanded Booky panel retry, explicitly collapses Booky, then checks and captures the globe notice after stable layout samples. The narrow screenshot therefore shows Booky collapsed. Trial clicks check actionability only; no second retry execution is claimed.',
  'The original browser-a1 behavior run passed 3 cases, but its notice overlapped globe instructions and was covered by Booky during visual inspection. Those reports remain preserved and do not support final visual acceptance.',
  'Browser-a2 failed when the expanded mobile Booky overlay intercepted the underlying globe retry. The final fixture verifies the panel retry and explicit close before the globe retry.',
  'Browser-a3 passed behavior but visual inspection found the mobile Appearance toggle overlapping notice text. The final CSS and geometry check account for those controls; earlier screenshots are not final visual acceptance.',
  'The application opts in through isPlanetApplication. The public-site default and initial module failure fallback retain their original code paths; this browser fixture does not execute a separate public-site or module-failure case.',
  'The 265 previous controller tests are preserved historical evidence from source ' + prior.sourceCommit + '; no unit tests were rerun for this scene lifecycle change.',
  'Actual-App Chrome uses controlled native ports and HTTP failures. Fresh PWA and Android-dev artifacts bind the new source; the built-PWA browser case is the existing offline/download smoke, not this source fixture.',
  'All 34 inventoried dialogue records remain draft. No reviewed content, production journey, narration, child access or new approval is introduced.',
  'Visual review covers only the preserved screenshots. It is not formal art, accessibility, installed-device/performance, iOS, stage or release acceptance.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'ADULT_BOOKY_CATALOG_SCENE_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), previousRuntime: await ref(entry.previousRuntime), checkpointHelper: await ref(fileURLToPath(import.meta.url)),
  attempts: { ...attempts, pwa: pwaAttempt, android: androidAttempt }, earlierAttempts, runs, sourceManifest,
  priorUnitEvidence: entry.priorUnitEvidence, retainedUnitCount, unitRerun: false, unitEvidenceSourceCommit: prior.sourceCommit,
  browserCases: 3, sceneRetentionCases: 2, initialFailureCases: 1, actualAppCaptures, browserAttachments, attachmentBytesMatchOriginal: true, validatedBehavior,
  visualReview: await ref(visualPath), inspectedImageCount: visual.images.length, protectedInputCount: entry.preservedInputs.length,
  preservedInputsVerified: true, unchangedTrackedInputCount: entry.protectedFiles.length, protectedFilesVerified: true,
  changedSourcePaths: changed, newSourcePaths: added, gitIdentityDifferences: [...gitIdentityDifferences.values()],
  starterSetSourceInventory: priorRuntime.starterSetSourceInventory, inventoryHistorical: true, inventoryAuditRerun: false, inventoryChangedInputs,
  historicalStarterSetCounts: { required: 29, sourceBound: 13, accepted: 0, ownerAdded: 3 },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, buildHelpers, exactFreshArtifactInputsVerifiedAgainstSourceCommit: true,
  copyVerification: await ref(copyPath), pwaBrowserReport: await ref(folder + '/pwa-' + pwaAttempt + '/playwright.json'),
  priorPwa: entry.priorPwa, priorAndroid: entry.priorAndroid, decisionD160Recorded: true,
  criteriaUpdated: affectedIds.map(id => 'S15.' + id), criterionChanges: [], requirementChanges: [], stageChanges: [], allStageAndCriterionStatusesUnchanged: true,
  firstUnresolved: 'S03.acceptance', limitations, nextAction, actualApp: true, actualCss: true, actualGlobe: true,
  currentCatalogReadinessRequired: true, readyOfflineCatalogAllowed: true, selectionDependentProgressProtected: true,
  applicationSceneRetainedAcrossCatalogReload: true, initialFailureHasNoScene: true, artChanged: false, globeSceneChanged: false,
  installedNativeDevice: false, builtPwaCatalogSceneExecution: false, reviewedDialogueAccepted: false, narrationEnabled: false, childApproved: false,
  childProfileCreated: false, childAccessGranted: false, ageAdaptiveJourneysEnabled: false, fullJourneyMigrationAccepted: false,
  artAccepted: false, screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false,
  grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, readmePath, visualPath, sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
const scopedNote = ' The application retains its existing canonical globe across catalog loading/failure/recovery while current readiness still gates Booky actions and progress. First failure retains the original fallback. TypeScript, 3 actual-App Chrome cases and ' + visual.images.length + ' inspected views bind fresh preserved PWA/Android-dev builds; 265 prior controller tests are retained without rerun. No stage, child, reviewed-content or release acceptance is claimed.';
for (const id of affectedIds) {
  const criterion = stage.criteria.find(item => item.id === 'S15.' + id), requirement = trace.requirements.find(item => item.id === id);
  criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += scopedNote; push(criterion.evidence, resultPath);
  requirement.commit = sourceCommit; requirement.notes += scopedNote; push(requirement.evidence, resultPath);
  for (const file of runtimeRequired) push(requirement.implementationFiles, file);
  push(requirement.tests, 'tests/pwa/booky-catalog-scene.spec.mjs');
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, 'node ' + folder + '/check.mjs ' + mode + ' ' + attempt);
for (const command of ['node ' + folder + '/build-pwa.mjs ' + sourceCommit, 'pwsh -File ' + folder + '/build-android.ps1 ' + sourceCommit, 'node ' + folder + '/preserve-android.mjs ' + sourceCommit]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 application catalog-retry scene retention: renderer/camera/scene identity survives loading/error/recovery; current catalog readiness still protects actions/progress. Initial failure remains the original fallback. Prior 265 unit tests are historical, not rerun; no stage or release acceptance.');
state.verificationCache.s15BookyCatalogScene = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
assert.deepEqual(trace.requirements.filter(item => !affectedIds.includes(item.id)), priorTrace.requirements.filter(item => !affectedIds.includes(item.id)));
assert.deepEqual(trace.requirements.map(item => [item.id, item.status]), priorTrace.requirements.map(item => [item.id, item.status]));
const sourceRows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(originalsDocs.get(globalFiles[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(priorTrace, sourceRows));
const decision = '\n- D160: Source ' + sourceCommit + ' keeps the same application canvas, renderer, camera and scene across catalog loading/failure/recovery while current readiness continues to gate Booky actions and semantic progress. Initial catalog failure keeps the original fallback. TypeScript, 3 actual-App Chrome cases and ' + visual.images.length + ' inspected views bind fresh PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + '. The prior 265 controller tests are retained without rerun; built-PWA coverage remains the offline/download smoke. ' + entry.preservedInputs.length + ' protected inputs remain exact. PLANETKA-005 and every stage/criterion status stay unchanged; S03.acceptance remains first unresolved. Child, reviewed dialogue, accessibility, installed-device and release gates stay open. Evidence: evidence/S15/booky-catalog-scene-20260923/result.json.\n';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ': application catalog retry preserves the existing canonical scene while truthful catalog readiness continues to gate Booky actions and progress. Initial failure retains the original fallback.\nTypeScript, 3 actual-App Chrome cases, ' + visual.images.length + ' inspected views and fresh preserved PWA ' + pwa.buildId.slice(0, 8) + ' / Android-dev ' + android.buildId.slice(0, 8) + '. Prior 265 controller tests retained without rerun; built-PWA coverage is the offline/download smoke.\nPLANETKA-005 remains IN_PROGRESS; all stage/criterion statuses stay unchanged: 3 complete, 12 in progress, 26 unstarted. S03.acceptance remains first unresolved; releaseReady:false.\nEvidence: evidence/S15/booky-catalog-scene-20260923/result.json.\n' + nextAction + '\n<!-- s15-catalog-scene-20260923:end -->\n\n';
const readme = '# S15 application globe retention across catalog retry\n\nSource: ' + sourceCommit + '.\n\n' + scopedNote.trim() + '\n\n' + limitations.map(item => '- ' + item).join('\n') + '\n\nNext: ' + nextAction + '\n';
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision],
  ...globalFiles.slice(2, 5).map(file => [file, note + originalsDocs.get(file)]),
  [globalFiles[5], json(trace)], [globalFiles[6], projectTraceabilityCsv(trace, sourceRows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalsDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(readmePath, readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, retainedUnitCount, unitRerun: false, browserCases: 3, inspectedImages: visual.images.length,
  counts, criterionChanges: [], firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
