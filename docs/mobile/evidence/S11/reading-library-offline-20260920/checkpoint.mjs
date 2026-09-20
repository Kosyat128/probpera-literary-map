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
const folder = 'docs/mobile/evidence/S11/reading-library-offline-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-reading-offline';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/reading-library.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const required = ['src/hooks/useReadingLibrary.ts', 'src/hooks/readingLibraryStorage.ts', 'src/components/ReadingLibrarySyncNotice.tsx',
  'src/components/ReadingLibrarySyncNotice.css', 'src/components/ArticleReader.tsx', 'src/components/BookArchiveSection.tsx', 'src/community/CommunityHub.tsx'];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S11'); assert.equal(entry.checkpoint, '312dceef424965c79b50b9c4f0bafb72a667ee11');
assert.equal(entry.previous, 'docs/mobile/evidence/S04/native-locale-20260920/result.json');
assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 24); await verifyInputs(entry.preservedInputs);
await verifyInputs([prior.visualReview, prior.priorVisualReview, prior.priorArtReview, prior.priorArtCapture]);
const inventory = await verifyRef(prior.starterSetSourceInventory), inventoryChangedInputs = [];
assert.equal(inventory.auditValid, true);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }
for (const item of inventory.sourceInputs) {
  const current = await ref(item.path);
  if (current.sha256 !== item.sha256) {
    assert.equal(item.path, 'src/hooks/useReadingLibrary.ts', 'Only the changed reading-library hook may differ from the historical inventory');
    inventoryChangedInputs.push({ path: item.path, priorSha256: item.sha256, currentSha256: current.sha256 });
  }
}
assert.equal(inventoryChangedInputs.length, 1);

const unitFiles = ['src/hooks/useReadingLibrary.test.ts'], units = await read(`${folder}/unit-${unitAttempt}/vitest.json`);
assert.deepEqual(units.testResults.map(item => normalized(item.name)), unitFiles.map(normalized));
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
for (const mode of ['unit', 'static']) {
  if (attempts[mode] === 'a1') continue;
  const file = `${folder}/${mode}-a1/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, 'a1'); noApproval(report);
  // Retain the old manifest itself by hash; its source bytes are historical.
  await verifyRef(report.sourceManifest);
  earlierAttempts.push({ ...await ref(file), mode, attempt: 'a1', pass: report.pass, tests: report.tests,
    sourceManifest: report.sourceManifest, supersededSource: report.sourceManifest.sha256 !== sourceManifest.sha256,
    reason: mode === 'unit' ? 'One real same-key ordering regression: the local write was mistaken for an external write and prematurely aborted the older request.'
      : 'TypeScript passed for the earlier source; final source validation is recorded separately.' });
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.match(specs[0].title, /^reading library keeps offline intent/u);
const copies = attachments.filter(item => item.name === 'reading-library-result' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'reading-library-result.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const sourceFixtureCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), fixture = await read(sourceFixtureCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(sourceFixtureCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(sourceFixtureCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'sourceFixture', 'actualReactStrictModeAndLocalStorage', 'actualSyncNotice', 'remoteTransportStubbed',
  'lazyThenableTransport', 'strictModeAndSecondConsumerDoNotDuplicateMutations', 'acceptedBeforeRemoteResponse',
  'rejectedRemoteDoesNotRollbackLocalChoice', 'atomicAdultItemsAndPendingRestoredOnReload', 'pendingDeleteShieldsStaleHydration',
  'automaticReconnectRetriesExactlyOnce', 'guestDataPreservedAndNeverUploaded', 'accountScopedRestoration', 'dossierProgressKeptLocal']) assert.equal(fixture[key], true, key);
noApproval(fixture, ['actualFullApp', 'actualGlobe', 'installedNative', 'releaseReady', 'timeoutCoveredHere']);
assert.equal(fixture.mountedConsumers, 2); assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.unexpectedRequests, []);
await verifyInputs(fixture.sourceInputs); requireInputs(fixture.sourceInputs, required.slice(0, 4));
assert.equal(fixture.calls.filter(item => item.operation !== 'select').length, 7);
assert.deepEqual(fixture.screenshots.map(item => item.filename).sort(), ['reading-library-pending-en-1440.png', 'reading-library-pending-ru-390.png']);
const images = fixture.screenshots.map(item => ({ path: path.join(path.dirname(sourceFixtureCapture.path), item.filename), sha256: item.sha256 })); await verifyInputs(images);
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.sourceCommit, sourceCommit); assert.deepEqual(visual.sourceManifest, sourceManifest);
assert.equal(normalized(visual.sourceFixtureCapture.path), normalized(sourceFixtureCapture.path)); assert.equal(visual.sourceFixtureCapture.sha256, sourceFixtureCapture.sha256);
noApproval(visual, ['actualFullApp', 'actualGlobe', 'artAccepted', 'childApproved', 'userRealismRequirementSatisfied', 'releaseReady']);
assert.equal(visual.images.length, 2); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, 2);
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
for (const [reference, entryRef, buildId] of [[prior.pwa, entry.priorPwa, '0aeec9ebd97c35ccde99b5db77ba24b3dcfb9b670e5ff16fa3215627cd89205b'],
  [prior.android, entry.priorAndroid, 'a2cb29ef2409f92afc3d9b5fdbb27ec2d7ca09383bfce994c2776dd8a27677cf']]) {
  assert.deepEqual(reference, entryRef); const old = await verifyRef(reference);
  assert.equal(old.pass, true); assert.equal(old.buildId, buildId); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// Preflight every document and prepare every replacement before any state write.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalDocs = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalDocs.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S11');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const expectedStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s04NativeLocale.path, entry.previous); await verifyRef(state.verificationCache.s04NativeLocale);
assert.equal(state.verificationCache.s11ReadingLibraryOffline, undefined);
const criterionIds = ['S11.CONTENT-007', 'S11.CONTENT-009'];
for (const id of criterionIds) {
  assert.equal(stage.criteria.find(item => item.id === id).status, 'OPEN');
  expectedStatuses.find(([stageId]) => stageId === 'S11')[2].find(([criterionId]) => criterionId === id)[1] = 'IN_PROGRESS';
}
const decisions = originalDocs.get(globalFiles[1]), marker = '<!-- s11-reading-library-offline-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D143:/gmu)].length, 1); assert.equal(/^- D144:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalDocs.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const limitations = ['Concurrent-tab read/modify/write is not atomic.', 'Full distributed add-wins and conflict resolution remain open.',
  'Ordering of unabortable remote requests is not guaranteed.', 'Remote transport is controlled; actual network and installed-native execution are not established.'];
const nextAction = 'Continue the full application plan from the next bounded internal requirement. Preserve durable account-scoped pending reading-library intent, local-only dossier progress, guest isolation and truthful retry/persistence status. Keep the existing scene, joint appearance draft and foreground locale priority. Full distributed sync/conflict resolution, concurrent-tab atomicity, unabortable remote ordering, actual network/native-device behavior, accessories/audio/catalog, child, screen-reader, art/lightmap, iOS and release gates remain open. Do not rerun unchanged geometry or historic checks.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S11', status: 'READING_LIBRARY_OFFLINE_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, earlierAttempts, runs, sourceManifest, unitCount, unitFiles, browserCases: 1,
  sourceFixtureCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryHistorical: true, inventoryReusedWithCurrentInputsVerified: false,
  inventoryUnchangedInputsVerified: true, inventoryChangedInputs, inventoryAuditRerun: false,
  historicalStarterSetCounts: { required: 29, sourceBound: 12, accepted: 0, ownerAdded: 3 }, ownerAdditionIds: prior.ownerAdditionIds,
  preservedInputs: entry.preservedInputs, priorVisualReview: prior.visualReview, priorSceneVisualReview: prior.priorVisualReview,
  priorArtReview: prior.priorArtReview, priorArtCapture: prior.priorArtCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD144Recorded: true, criterionChanges: criterionIds.map(id => ({ id, from: 'OPEN', to: 'IN_PROGRESS' })), limitations,
  sourceFixture: true, actualReactHookAndSyncNotice: true, actualFullApp: false, actualGlobe: false, remoteTransportStubbed: true,
  installedNativeDevice: false, actualNetworkVerified: false, concurrentTabsAtomic: false, distributedConflictResolutionAccepted: false,
  unabortableRemoteOrderingGuaranteed: false, geometryRerun: false, newArtCapture: false, artAccepted: false,
  likenessAccepted: false, userRealismRequirementSatisfied: false, childApproval: false, rightsApproval: false,
  screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false, grantsEntitlement: false,
  productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, sourceManifest.path, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const id of criterionIds) {
  const criterion = stage.criteria.find(item => item.id === id); criterion.status = 'IN_PROGRESS'; push(criterion.evidence, resultPath);
  criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt;
  criterion.notes += ` Adult reading-library edits and deletion intents survive a document reload in a scoped local envelope and remain visible after remote failure. Two same-document consumers share retry state; guest data and dossier progress stay local. ${unitCount} hook cases, TypeScript and one real-Chrome hook/notice fixture with controlled remote transport bind local PWA/Android artifacts. Concurrent-tab read/modify/write is not atomic; distributed add-wins/conflict resolution and unabortable remote ordering remain open. Full App, actual network, native-device and full criterion acceptance are not established.`;
}
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
for (const command of [`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`]) push(stage.lastGreenCommands, command);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S11 reading-library offline: ${unitCount} cases in the hook suite, TypeScript, one real-Chrome hook/notice fixture with two consumers/reload and stubbed remote transport, and source-bound local PWA/Android builds. Twenty-four scene/locale sources stay unchanged. Historical Starter Set inventory retains its original hash with the changed hook explicitly listed; no inventory/art/geometry rerun or full App/native/network acceptance is claimed.`);
state.verificationCache.s11ReadingLibraryOffline = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
const decision = `\n- D144: Keep adult reading-library items and pending mutations together in durable account-scoped local state, retaining local intent after controlled remote failure and exposing truthful retry/persistence status. Source ${sourceCommit} has ${unitCount} focused hook cases, TypeScript, one real-Chrome hook/notice fixture with two consumers and reload, and local PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. Only S11.CONTENT-007 and S11.CONTENT-009 advance OPEN to IN_PROGRESS. Twenty-four scene/locale inputs are unchanged. The prior Starter Set inventory is historical (29 required / 12 source-bound / zero accepted plus three owner additions); its changed hook binding is explicit and the inventory is not re-bound overall. Concurrent-tab atomicity, distributed add-wins/conflict resolution, unabortable remote ordering, actual network, installed-device and release acceptance remain open. Evidence: evidence/S11/reading-library-offline-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} preserves adult reading-library pending intent across reloads and remote failure, with scoped retry and local persistence status.\n${unitCount} cases in one hook suite, TypeScript, one real-Chrome hook/notice fixture and one PWA offline smoke pass. The fixture uses controlled remote transport, not the full App, globe, actual network or installed native device.\nOnly S11.CONTENT-007 and S11.CONTENT-009 change OPEN to IN_PROGRESS. Twenty-four scene/locale sources are retained; historic Starter Set counts remain 29/12/0 plus three owner additions, with the changed hook hash explicit and no current whole-inventory claim.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S11/reading-library-offline-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s11-reading-library-offline-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalDocs.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalDocs) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, counts, firstOpen: 'S03', criterionChanges: result.criterionChanges, stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
