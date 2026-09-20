import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Usage: node docs/mobile/evidence/S04/native-locale-20260920/checkpoint.mjs <source40> [browserAttempt=a2]
// Validate existing evidence only; no tests, builds, inventory audit or capture.
const [sourceCommit, browserAttempt = 'a2', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.match(browserAttempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S04/native-locale-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s04-locale';
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile', 'tests/host/host-language-status.test.ts',
    'tests/pwa/native-foreground-language.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const required = ['src/host/HostPlatformServices.ts', 'src/platform/ports.ts', 'src/platform/adapters/android/AndroidPlatformAdapter.ts',
  'src/host/HostRuntimeStatus.tsx', 'src/host/mountHostApp.tsx', 'src/i18n/InterfaceLanguage.tsx'];
const requireInputs = (inputs, files = required) => { for (const file of files) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S04'); assert.equal(entry.checkpoint, '3a14b48421783382eca2f49009d94f3353903f41');
assert.equal(entry.previous, 'docs/mobile/evidence/S13/combined-preview-20260920/result.json');
assert.equal(prior.sourceCommit, 'b63112bb3bf3131f1dc4ddea86acbe40cd9baf3f'); assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 18); await verifyInputs(entry.preservedInputs);
const priorVisual = await verifyRef(prior.visualReview); await verifyInputs([prior.priorVisualReview, prior.priorArtCapture]);
for (const item of entry.preservedInputs) assert.ok(priorVisual.sourceInputs.some(previous => previous.path === item.path && previous.sha256 === item.sha256), item.path);
const inventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.auditValid, true); await verifyInputs(inventory.sourceInputs);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }

const unitFiles = ['src/host/HostPlatformServices.test.ts', 'src/platform/adapters/android/AndroidPlatformAdapter.test.ts',
  'tests/host/host-language-status.test.ts', 'src/i18n/InterfaceLanguage.pwa.test.tsx'];
const units = await read(folder + '/unit-a1/vitest.json'), cases = units.testResults.flatMap(item => item.assertionResults);
assert.deepEqual(units.testResults.map(item => normalized(item.name)).sort(), unitFiles.map(normalized).sort());
assert.equal(cases.length, 170); assert.ok(cases.every(item => item.status === 'passed'));
const attempts = { unit: 'a1', static: 'a1', browser: browserAttempt }, runs = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0); noApproval(report);
  await verifyInputs(report.sourceInputs); requireInputs(report.sourceInputs);
  assert.deepEqual(report.tests, mode === 'unit' ? { passed: 170, failed: 0, skipped: 0 }
    : mode === 'browser' ? { passed: 1, failed: 0, skipped: 0, flaky: 0 } : null);
  runs[mode] = { ...await ref(file), tests: report.tests };
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], specs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { specs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(specs.length, 1); assert.match(specs[0].title, /^foreground OS locale follows confirmed absence/u);
const copies = attachments.filter(item => item.name === 'foreground-language-source-evidence' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'native-foreground-language.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true);
noApproval(app, ['installedNative', 'releaseReady']); await verifyInputs(app.sourceInputs);
requireInputs(app.sourceInputs, required.filter(file => file !== 'src/platform/ports.ts'));
for (const key of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[key], []);
assert.ok(Array.isArray(app.observations));
for (const [label, language, sameDocument] of [['foreground-system-english', 'en', true],
  ['explicit-russian-wins-late-system-english', 'ru', true], ['saved-russian-cold-mount-with-system-english', 'ru', false]]) {
  const observations = app.observations.filter(item => item.label === label); assert.equal(observations.length, 1);
  assert.equal(observations[0].language, language); assert.equal(observations[0].surfaceCount, 1);
  if (sameDocument) assert.equal(observations[0].sameScene, true);
}
// Opening the deep-linked writer legitimately records Recent history. Only
// that exact unrelated key is excluded; all locale/composition writes remain.
assert.deepEqual(app.preferenceOperations.filter(item => item.operation !== 'get' && item.key !== 'probpera-planet-recent-adult-v1'),
  [{ operation: 'set', key: 'probpera-interface-language', value: 'ru' }]);
const images = await Promise.all(['foreground-system-en-1440.png', 'foreground-explicit-ru-1440.png']
  .map(name => ref(path.join(path.dirname(actualAppCapture.path), name))));
const visualPath = folder + '/visual-review.json', visual = await read(visualPath);
assert.equal(visual.sourceCommit, sourceCommit); await verifyInputs(visual.sourceInputs); requireInputs(visual.sourceInputs);
noApproval(visual, ['artAccepted', 'childApproved', 'userRealismRequirementSatisfied', 'releaseReady']);
assert.equal(normalized(visual.actualAppCapture.path), normalized(actualAppCapture.path)); assert.equal(visual.actualAppCapture.sha256, actualAppCapture.sha256);
assert.ok(Array.isArray(visual.images) && visual.images.length > 0); assert.equal(new Set(visual.images.map(item => normalized(item.path))).size, visual.images.length);
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
for (const [reference, buildId] of [[prior.pwa, '58e13fb09fdae6e674bc1527e81f7004a43e4e968dcaabeac4d1a1be2f8f3aae'],
  [prior.android, '104fc45994a8de303ec0725aac6e29e173726c1ba231b47f47ea0796d26cdcfa']]) {
  const old = await verifyRef(reference); assert.equal(old.pass, true); assert.equal(old.buildId, buildId); assert.equal(old.sourceCommit, prior.sourceCommit);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// All reads, assertions and serialization precede state writes. Only BIL-018
// advances from OPEN to IN_PROGRESS; every stage and other criterion is retained.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalsByFile = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalsByFile.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S04');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const expectedStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s13CombinedPreview.path, entry.previous); await verifyRef(state.verificationCache.s13CombinedPreview);
const criterion = stage.criteria.find(item => item.id === 'S04.BIL-018'); assert.equal(criterion.status, 'OPEN');
expectedStatuses.find(([id]) => id === 'S04')[2].find(([id]) => id === 'S04.BIL-018')[1] = 'IN_PROGRESS';
const decisions = originalsByFile.get(globalFiles[1]), marker = '<!-- s04-native-locale-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D142:/gmu)].length, 1); assert.equal(/^- D143:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalsByFile.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const initialBrowser = await read(folder + '/browser-a1/result.json'); assert.equal(initialBrowser.pass, false);
const nextAction = 'Continue the full application plan from the next bounded internal requirement. Preserve live foreground language refresh, confirmed-absence and explicit/saved-choice priority, one canonical language provider, the joint stand/background draft and existing scene. Reuse unchanged catalog/geometry/art evidence. Real Android system-language surfaces and installed-device behavior, full accessories/audio/catalog, child, screen-reader, art/lightmaps, iOS and release gates remain open; do not repeat valid checks of unchanged inputs.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S04', status: 'NATIVE_LOCALE_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, runs, unitCount: 170, unitFiles, browserCases: 1,
  initialBrowserFixtureFailure: { ...await ref(folder + '/browser-a1/result.json'), tests: initialBrowser.tests,
    reason: 'The fixture counted the legitimate deep-linked writer Recent-history write before OS-language checks. Only the exact Recent-history key was excluded from that assertion; full operations remain recorded.' },
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  starterSetSourceInventory: prior.starterSetSourceInventory, inventoryReusedWithCurrentInputsVerified: true, inventoryAuditRerun: false,
  requiredStarterItems: 29, sourceBoundStarterItems: 12, acceptedStarterItems: 0, ownerAddedCount: 3, ownerAdditionIds: prior.ownerAdditionIds,
  preservedInputs: entry.preservedInputs, priorCombinedPreview: await ref(entry.previous), priorVisualReview: prior.visualReview,
  priorArtReview: prior.priorVisualReview, priorArtCapture: prior.priorArtCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD143Recorded: true, criterionChange: { id: 'S04.BIL-018', from: 'OPEN', to: 'IN_PROGRESS' }, actualSceneRenderedInChrome: true,
  controlledNativePorts: true, installedNativeDevice: false, actualAndroidOsLanguageReadVerified: false, androidSystemLanguageSurfacesVerified: false,
  geometryRerun: false, newArtCapture: false, artAccepted: false, likenessAccepted: false, userRealismRequirementSatisfied: false,
  childApproval: false, rightsApproval: false, screenReaderAcceptance: false, devicePerformanceAccepted: false, iosCompiled: false,
  grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
criterion.status = 'IN_PROGRESS'; push(criterion.evidence, resultPath); criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt;
criterion.notes += ' Android adapter refreshes the OS app-language on genuine foreground; the canonical provider follows it only after confirmed absence of a saved choice. Explicit/saved choices and stale-read fences preserve priority and the existing scene. 170 selected cases, TypeScript and one real-App Chrome case with controlled OS ports are source-bound to local PWA/Android artifacts. Actual Android OS reads, system-language settings surfaces and installed-device behavior are not established.';
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/check.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S04 native locale: 170 cases across the four named suites, TypeScript, one actual-App Chrome case using controlled native language/lifecycle/preferences and local source-bound PWA/Android builds. Existing inventory/geometry/art evidence is reused by hash; real OS language surfaces, installed-device, whole-stage and release acceptance remain open.');
state.verificationCache.s04NativeLocale = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), expectedStatuses);
const decision = `\n- D143: Refresh the live Android app-language on genuine foreground through the existing platform adapter and canonical language provider. Follow the OS value only after confirmed absence of a saved choice; explicit/saved choices and stale-read fences retain priority without remounting the current scene. Source ${sourceCommit} has 170 selected cases in four suites, TypeScript, one actual-App Chrome case with controlled native ports, and preserved PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. Only S04.BIL-018 advances OPEN to IN_PROGRESS. Eighteen scene/appearance sources and the existing 29/12/0 Starter Set inventory plus three owner additions remain preserved. Actual OS-language reads/settings surfaces, installed-device, screen-reader, child and release acceptance remain open. Evidence: evidence/S04/native-locale-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} adds foreground Android language refresh while retaining explicit/saved preference priority and the existing scene.\n170 cases in four selected suites, TypeScript, one controlled-native actual-App Chrome case and one PWA offline smoke pass. This is not an installed Android OS-language or system-settings test.\nS04.BIL-018 changes OPEN to IN_PROGRESS; every other criterion and all stage statuses remain unchanged. Existing inventory is reused with current source hashes: 29 required / 12 source-bound / zero accepted, plus three owner additions.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S04/native-locale-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s04-native-locale-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalsByFile.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalsByFile) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, counts, firstOpen: 'S03', criterionChange: result.criterionChange, stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
