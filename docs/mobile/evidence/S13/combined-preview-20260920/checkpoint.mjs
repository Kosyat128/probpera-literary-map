import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Usage: node docs/mobile/evidence/S13/combined-preview-20260920/checkpoint.mjs <source40> [browserAttempt=a2]
// Record existing scoped evidence only. No tests, builds or visual capture run here.
const [sourceCommit, browserAttempt = 'a2', ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.match(browserAttempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const normalized = value => path.resolve(value).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/combined-preview-20260920';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-combined';
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const cleanSource = () => {
  assert.equal(git(['rev-parse', 'HEAD']), sourceCommit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts/mobile',
    'tests/pwa/globe-composition.spec.mjs', 'tests/pwa/globe-background-customization.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']), '');
};
async function verifyInputs(inputs) {
  assert.ok(Array.isArray(inputs) && inputs.length); assert.equal(new Set(inputs.map(item => item.path)).size, inputs.length);
  for (const item of inputs) { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); }
}
async function verifyRef(reference) { await verifyInputs([reference]); return read(reference.path); }
const noApproval = (record, flags = ['stageAccepted', 'artAccepted', 'releaseReady']) => { for (const flag of flags) assert.equal(record[flag], false, flag); };
const required = ['src/host/planetComposition.ts', 'src/host/PlanetStandControls.tsx', 'src/host/PlanetStandControls.css'];
const requireInputs = inputs => { for (const file of required) assert.ok(inputs.some(item => item.path === file), file); };
cleanSource();
const entry = await read(folder + '/entry.json'), prior = await read(entry.previous);
assert.equal(entry.stage, 'S13'); assert.equal(entry.checkpoint, '0373b470e50af979419ffe65751a4eb4e0981f9c');
assert.equal(entry.previous, 'docs/mobile/evidence/S13/visual-refinement-20260920/result.json');
assert.equal(prior.sourceCommit, '585e3af609f718ae3c2e1eb75fc1aa610d640723'); assert.equal(prior.pass, true); noApproval(entry); noApproval(prior);
assert.equal(entry.preservedInputs.length, 15); await verifyInputs(entry.preservedInputs);
const priorVisual = await verifyRef(prior.visualReview); await verifyInputs([prior.artCapture]);
for (const item of entry.preservedInputs) assert.ok(priorVisual.sourceInputs.some(previous => previous.path === item.path && previous.sha256 === item.sha256), item.path);
// Prior art review and capture remain historical; changed controller/UI source
// must not be checked against that review or be given a new art acceptance.

const units = await read(folder + '/unit-a1/vitest.json'), cases = units.testResults.flatMap(item => item.assertionResults);
assert.equal(units.testResults.length, 1); assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.ok(normalized(units.testResults[0].name).endsWith('/src/host/planetComposition.test.ts'));
const unitCount = cases.length, attempts = { unit: 'a1', static: 'a1', browser: browserAttempt }, runs = {};
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.mode, mode); assert.equal(report.attempt, attempt); assert.equal(report.pass, true);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0); noApproval(report);
  await verifyInputs(report.sourceInputs); requireInputs(report.sourceInputs);
  assert.deepEqual(report.tests, mode === 'unit' ? { passed: unitCount, failed: 0, skipped: 0 }
    : mode === 'browser' ? { passed: 1, failed: 0, skipped: 0, flaky: 0 } : null);
  runs[mode] = { ...await ref(file), tests: report.tests };
}
const browser = await read(`${folder}/browser-${browserAttempt}/playwright.json`), attachments = [], selectedSpecs = [];
assert.deepEqual([browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky], [1, 0, 0, 0]); assert.deepEqual(browser.errors, []);
const visit = suite => { for (const spec of suite.specs ?? []) { selectedSpecs.push(spec); for (const test of spec.tests ?? []) for (const result of test.results ?? []) attachments.push(...result.attachments ?? []); } for (const child of suite.suites ?? []) visit(child); };
for (const suite of browser.suites) visit(suite);
assert.equal(selectedSpecs.length, 1); assert.match(selectedSpecs[0].title, /^one composition migrates/u);
const copies = attachments.filter(item => item.name === 'composition-source-evidence' && item.path); assert.equal(copies.length, 1);
const originals = [];
for (const child of await fs.readdir(`${artifacts}/browser-${browserAttempt}`, { withFileTypes: true })) {
  assert.equal(child.isSymbolicLink(), false); if (!child.isDirectory()) continue;
  const file = path.join(artifacts, 'browser-' + browserAttempt, child.name, 'globe-composition.json');
  try { if ((await fs.stat(file)).isFile()) originals.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(originals.length, 1);
const actualAppCapture = await ref(originals[0]), browserAttachment = await ref(copies[0].path), app = await read(actualAppCapture.path);
assert.ok(normalized(browserAttachment.path).startsWith(normalized(path.dirname(actualAppCapture.path)) + '/attachments/'));
assert.ok((await fs.readFile(actualAppCapture.path)).equals(await fs.readFile(browserAttachment.path)));
for (const key of ['pass', 'actualApp', 'actualCss', 'actualGlobe']) assert.equal(app[key], true);
noApproval(app, ['installedNative', 'entitlementGranted', 'releaseReady']);
for (const key of ['errors', 'externalRequests', 'missingResources']) assert.deepEqual(app[key], []);
assert.ok(Array.isArray(app.observations)); assert.ok(app.observations.some(item => item.combinedDraft && item.noDraftWrites === true && item.oneCombinedApply === true));
assert.ok(app.observations.some(item => item.restored && item.legacyPreferencesUnchanged === true)); assert.equal(app.lastScene.surfaceCount, 1);
const legacyKeys = ['probpera.globe-edition.v2', 'probpera.globe-style.v1', 'probpera-planet-stand-v1', 'probpera-planet-background-v1'];
assert.deepEqual(app.preferenceOperations.filter(item => item.operation !== 'get' && legacyKeys.includes(item.key)), []);
const images = await Promise.all(['composition-combined-preview-ru-1440.png', 'composition-combined-preview-en-390.png', 'composition-edition-applied-en.png']
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
const inventoryPath = folder + '/starter-set-source-inventory.json', inventory = await read(inventoryPath), oldInventory = await verifyRef(prior.starterSetSourceInventory);
assert.equal(inventory.auditValid, true); await verifyInputs(inventory.sourceInputs);
assert.deepEqual([inventory.requiredCount, inventory.sourceBoundCount, inventory.acceptedCount, inventory.ownerAddedCount], [29, 12, 0, 3]);
assert.deepEqual(inventory.items.map(item => item.id), oldInventory.items.map(item => item.id));
assert.deepEqual(inventory.ownerAdditions.map(item => item.id).sort(), oldInventory.ownerAdditions.map(item => item.id).sort());
for (const item of [...inventory.items, ...inventory.ownerAdditions]) { assert.equal(item.acceptance, 'OPEN'); assert.equal(item.releaseReady, false); }

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
for (const [reference, buildId] of [[prior.pwa, '1a5938c17f702adbb98f83be4238f651b093f7b9520ca890b68a8b83d1670d77'],
  [prior.android, '99a99dda4b83a82d4aad0c3838e2173ba8140b8cc230b546347a649312168f12']]) {
  const old = await verifyRef(reference); assert.equal(old.pass, true); assert.equal(old.buildId, buildId);
  await verifyInputs([{ path: old.artifact.path + '/artifact.json', sha256: old.artifact.artifactSha256 ?? old.artifact.sha256 }, ...(old.apk ? [old.apk] : [])]);
}

// No writes until every source/report/build precondition and destination guard
// succeeds; preserve all existing fields and every stage/criterion status.
const globalFiles = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md', 'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt'];
const originalsByFile = new Map(await Promise.all(globalFiles.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(originalsByFile.get(globalFiles[0])), stage = state.stages.find(item => item.id === 'S13');
const statuses = () => state.stages.map(item => [item.id, item.status, item.criteria.map(criterion => [criterion.id, criterion.status])]);
const beforeStatuses = statuses(), counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 11, NOT_STARTED: 27 }); assert.equal(state.currentStageId, 'S03');
assert.equal(state.stages.find(item => item.status !== 'COMPLETE').id, 'S03'); assert.equal(stage.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s13VisualRefinement.path, entry.previous); await verifyRef(state.verificationCache.s13VisualRefinement);
const decisions = originalsByFile.get(globalFiles[1]), marker = '<!-- s13-combined-preview-20260920:begin -->';
assert.equal([...decisions.matchAll(/^- D141:/gmu)].length, 1); assert.equal(/^- D142:/mu.test(decisions), false);
for (const file of globalFiles.slice(2)) assert.equal(originalsByFile.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const initialBrowser = await read(folder + '/browser-a1/result.json');
assert.equal(initialBrowser.pass, false);
assert.deepEqual(initialBrowser.tests, { passed: 0, failed: 0, skipped: 0, flaky: 0 });
const nextAction = 'Continue with S04.BIL-018: refresh the live Android app language on foreground while preserving saved/explicit language priority, rejecting stale OS-language replies and keeping the existing Canvas and semantic state. Preserve the joint stand/background draft, whole-draft Apply/Cancel and explicit-edition cancellation. Reuse unchanged geometry and prior visual evidence. Full accessories/audio/catalog, lightmaps/art/likeness, child, screen-reader, device, iOS and release gates remain open; do not repeat valid checks of unchanged inputs.';
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S13', status: 'COMBINED_PREVIEW_SCOPED_VALIDATION', pass: true,
  entry: await ref(folder + '/entry.json'), previous: await ref(entry.previous), attempts, runs, unitCount, browserCases: 1,
  initialBrowserConfigurationFailure: { ...await ref(folder + '/browser-a1/result.json'), executedCases: 0, reason: 'Anchored selection matched no full Playwright title; preserved as a configuration failure, not a runtime failure or a passed case.' },
  actualAppCapture, browserAttachment, attachmentBytesMatchOriginal: true, capturedImages: images, visualReview: await ref(visualPath), inspectedImageCount: visual.images.length,
  starterSetSourceInventory: await ref(inventoryPath), requiredStarterItems: 29, sourceBoundStarterItems: 12, acceptedStarterItems: 0, ownerAddedCount: 3,
  ownerAdditionIds: inventory.ownerAdditions.map(item => item.id), preservedInputs: entry.preservedInputs,
  priorVisualReview: prior.visualReview, priorArtCapture: prior.artCapture, retainedLibraryDensity: prior.retainedLibraryDensity, retainedPortrait: prior.retainedPortrait,
  unrunUpdatedFixture: { ...await ref('tests/pwa/globe-background-customization.spec.mjs'), executed: false,
    reason: 'Only stale tab expectations were updated; the older legacy-storage fixture is not part of this selected run.' },
  pwa: await ref(pwaPath), android: await ref(androidPath), pwaBuildId: pwa.buildId, androidBuildId: android.buildId, apk: android.apk,
  buildAudits, copyVerification: await ref(folder + '/pwa-a1/copy-verification.json'), priorPwa: prior.pwa, priorAndroid: prior.android,
  decisionD142Recorded: true, actualSceneRenderedInChrome: true, controlledNativePorts: true, geometryRerun: false, newArtCapture: false,
  artAccepted: false, likenessAccepted: false, userRealismRequirementSatisfied: false, childApproval: false, rightsApproval: false,
  screenReaderAcceptance: false, installedNativeDevice: false, devicePerformanceAccepted: false, iosCompiled: false,
  grantsEntitlement: false, productionActionsPerformed: false, stageAccepted: false, releaseReady: false, nextAction };
const push = (list, item) => { if (!list.includes(item)) list.push(item); };
for (const file of [folder + '/entry.json', resultPath, visualPath, inventoryPath, ...Object.values(runs).map(run => run.path), pwaPath, androidPath]) push(stage.artifacts, file);
for (const [id, note] of [['S13.CUSTOM-003', ' Stand and background tabs now retain one existing-controller draft; frame-confirmed Apply commits the whole pair once, while Cancel/native Back or explicit edition intent abandons both pending choices. Other composition parts remain outside this bounded slice.'],
  ['S13.CUSTOM-007', ` ${unitCount} actual controller cases, TypeScript, one selected Chrome case and one PWA offline smoke bind the current source and preserved builds. Geometry/art evidence is retained by hash; no new geometry run or art acceptance is claimed.`]]) {
  const criterion = stage.criteria.find(item => item.id === id); assert.equal(criterion.status, 'IN_PROGRESS');
  push(criterion.evidence, resultPath); criterion.commit = sourceCommit; criterion.lastValidatedAt = recordedAt; criterion.notes += note;
}
stage.lastGreenCommands = Object.entries(attempts).map(([mode, attempt]) => `node ${folder}/check.mjs ${mode} ${attempt}`);
stage.lastGreenCommands.push(`node ${folder}/run-pwa.mjs ${sourceCommit}`, `pwsh -File ${folder}/build-android.ps1 ${sourceCommit}`, `node ${folder}/preserve-android.mjs ${sourceCommit}`);
push(state.stages.find(item => item.id === 'S12').artifacts, inventoryPath); state.updatedAt = recordedAt; state.headSha = sourceCommit;
state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, `S13 combined preview: ${unitCount} controller cases, TypeScript, one selected actual Chrome case and source-bound PWA/Android builds. The second composition browser case and older background-storage fixture were not run. Geometry/art sources remain preserved; no whole accessories/audio/catalog, art, device or release acceptance.`);
state.verificationCache.s13CombinedPreview = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses);
const decision = `\n- D142: Keep one stand/background preview draft in the existing composition controller across both tabs. Whole-pair Apply requires the actual combined frame; Cancel/native Back or explicit edition intent abandons the draft. Source ${sourceCommit} has ${unitCount} selected controller cases, TypeScript, one actual Chrome case, scoped RU/EN UI inspection and preserved PWA ${pwa.buildId.slice(0, 8)} / Android-dev ${android.buildId.slice(0, 8)}. Fifteen protected scene/art sources remain byte-identical; no geometry/art rerun or new catalog IDs. Inventory stays 29 required / 12 source-bound / zero accepted, plus three owner additions. Full accessories/audio/catalog, art/lightmaps, child, screen-reader, device and release acceptance remain open. Evidence: evidence/S13/combined-preview-20260920/result.json.\n`;
const note = `${marker}\nSource ${sourceCommit.slice(0, 8)} preserves one joint stand/background draft across tabs and applies/cancels both parts together.\n${unitCount} controller cases, TypeScript, one selected actual Chrome case and one PWA offline smoke pass. Other browser fixtures and geometry suites were not rerun.\nFifteen scene/art sources and prior visual evidence are preserved; UI inspection is not art acceptance. Inventory remains 29 required / 12 source-bound / zero accepted, plus three owner additions.\nPWA ${pwa.buildId.slice(0, 8)}; Android-dev ${android.buildId.slice(0, 8)}. Evidence: evidence/S13/combined-preview-20260920/result.json.\nStages remain 3 complete, 11 in progress, 27 unstarted; first open S03.\n${nextAction}\n<!-- s13-combined-preview-20260920:end -->\n\n`;
const updates = new Map([[globalFiles[0], json(state)], [globalFiles[1], decisions + decision], ...globalFiles.slice(2).map(file => [file, note + originalsByFile.get(file)])]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); cleanSource();
for (const [file, original] of originalsByFile) assert.equal(await fs.readFile(file, 'utf8'), original, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount, counts, firstOpen: 'S03', stageStatusesUnchanged: true, releaseReady: false, result: resultPath }));
