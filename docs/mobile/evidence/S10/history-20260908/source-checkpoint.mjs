import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/history-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const [unitFolder = 'unit-a1', staticFolder = 'static-a3', historyFolder = 'browser-a4', collectionFolder = 'browser-a5'] = process.argv.slice(2);
for (const folder of [unitFolder, staticFolder, historyFolder, collectionFolder]) assert.match(folder, /^(?:unit|static|browser)-a[1-9][0-9]*$/);
const unit = await read(`${evidence}/${unitFolder}/result.json`), staticCheck = await read(`${evidence}/${staticFolder}/result.json`);
const repairFolder = 'unit-repair-a1', repair = await read(`${evidence}/${repairFolder}/result.json`);
const controlsFolder = 'unit-controls-a1', controls = await read(`${evidence}/${controlsFolder}/result.json`);
const browsers = await Promise.all([historyFolder, collectionFolder].map(folder => read(`${evidence}/${folder}/result.json`)));
for (const result of [unit, repair, controls, staticCheck, ...browsers]) assert.equal(result.pass, true);
const finalInputs = staticCheck.after;
for (const result of [controls, staticCheck]) for (const item of result.after) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
const visualPaths = new Set(['src/components/recent-history.css', 'src/styles/book-shelf-controls.css', 'src/components/BookShelfControls.tsx', 'src/components/BookShelfControls.test.tsx']);
for (const item of repair.after) if (!visualPaths.has(item.path)) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
const repairedPaths = new Set(['src/host/HostRecentHistory.ts', 'src/hooks/useBookCollections.test.ts', 'src/components/BookArchiveSection.tsx']);
for (const item of unit.after) if (!repairedPaths.has(item.path) && !visualPaths.has(item.path)) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
for (const folder of [historyFolder, collectionFolder]) for (const item of (await read(`${evidence}/${folder}/source-inputs.json`)).after) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
const reports = await Promise.all([unitFolder, repairFolder, controlsFolder].map(folder => read(`${evidence}/${folder}/vitest.json`))), testIds = new Set();
let totalTestExecutions = 0;
for (const report of reports) for (const file of report.testResults) for (const test of file.assertionResults) {
  assert.equal(test.status, 'passed'); testIds.add(file.name.replaceAll('\\', '/') + ':' + test.fullName); totalTestExecutions++;
}
const recordedAt = new Date().toISOString();
const result = { schemaVersion: 1, recordedAt, status: 'SOURCE_VALIDATION_PASSED', stage: 'S10',
  entry: `${evidence}/entry.json`, relatedScope: `${evidence}/collection-follow-up.json`, testedWorkingSourceSha256: sha(json(finalInputs)),
  implementation: ['src/host/HostRecentHistory.ts', 'src/host/HostPlatformServices.ts', 'src/host/mountHostApp.tsx', 'src/platform/ports.ts', 'src/planet/RecentHistory.tsx', 'src/components/RecentHistoryPanel.tsx', 'src/components/recent-history.css', 'src/App.tsx', 'src/hooks/useBookCollections.ts', 'src/components/BookArchiveSection.tsx', 'src/components/BookShelfControls.tsx', 'src/styles/book-shelf-controls.css'],
  validation: { uniqueUnitPasses: testIds.size, totalTestExecutions, repeatedAffectedPasses: totalTestExecutions - testIds.size, unitEvidence: [unitFolder, repairFolder, controlsFolder].map(folder => `${folder}/result.json`), staticEvidence: `${staticFolder}/result.json`, actualBrowserPasses: browsers.length,
    fixes: ['Static-a1 rejected ES2022 Object.hasOwn and Array.at under the existing target; replaced by compatible operations and reran only the two affected26-test suites.', 'Browser-a1 exposed history return focus stolen by duplicate close: asynchronous history.back left the old book URL visible to the render effect. Suppress no-event URL reopening until the expected popstate; keep the original trigger and existing close flow.', 'Original-resolution browser-a2/a3 screenshots exposed UA-style history buttons, overflowing collection storage copy and an unfocused autocomplete reopening over status. Reuse existing globe palette, wrap status within the rail, and keep suggestions tied to user focus; final browser verifies these changes.'],
    historicalFailures: ['static-a1/result.json', 'browser-a1/result.json'],
    earlierPassedBehavior: ['static-a2/result.json', 'browser-a2/result.json', 'browser-a3/result.json'],
    sourceBrowserEvidence: [historyFolder, collectionFolder].map(folder => `${folder}/result.json`),
    runtime: ['Native adult history uses the existing OS preference bridge, stores at most20 canonical targets and timestamps, serializes writes/readback, bounds confirmation waits and prevents old reads/writes undoing clear.',
      'Actual App source browser opens canonical writer/work, switches RUEN on the retained scene, reveals history writer outside the active filter, reloads persisted targets and clears locally.',
      'Collection persistence follows the actual local commit outcome; unavailable IndexedDB remains explicit session-only. A later remote sync failure does not roll back a successful local edit.'],
    sourceBrowserBoundary: 'Canonical App/scene in a browser with injected OS bridge; not installed Android or iOS runtime certification.' },
  canonicalDataChanged: false, newEditorialApprovalCreated: false, newUiCopyReviewStatus: 'draft',
  firstOpenCriterion: 'S03.acceptance', stageAccepted: false, releaseReady: false, productionActionsPerformed: false,
  remaining: ['Fresh Android/dev and local-QA PWA artifacts follow the source commit.',
    'Adult native history does not implement or accept separate child profiles/history, entitlements or downloads.',
    'Publication gate currently admits four books; prior10000 synthetic capacity is not a verified production catalog.',
    'Reviewed native/transliteration aliases, complete RUEN content/biographies, child/Planetka/3D, passport/store, edition covers/correction workflow and device/legal/release gates remain open.',
    'Frozen iOS83 unchanged and pending; no new iOS build.'] };
await fs.writeFile(`${evidence}/result.json`, json(result), { flag: 'wx' });
await fs.writeFile(`${evidence}/source-result.json`, json(result), { flag: 'wx' });
const state = await read(`${base}/AUTOPILOT_STATE.json`);
const protectedBefore = JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection });
assert.equal(state.currentCriterionId, 'S03.acceptance');
state.verificationCache.s10NativeHistory = { status: result.status, evidence: `${evidence}/result.json`, sha256: sha(json(result)), uniqueUnitPasses: testIds.size, sourceBrowserPasses: browsers.length, sourceInputsCurrent: true, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(value => value.id === 'S10');
stage.artifacts = [...new Set([...stage.artifacts, `${evidence}/result.json`])];
stage.lastGreenCommands = [`Focused native/Web history and collections: ${testIds.size} unit passes.`, 'Final TypeScript and platform-boundaries: pass', 'Actual App browser: native history RUEN/reload/clear and unavailable-IndexedDB collections: 2 pass'];
state.updatedAt = recordedAt;
state.resume.nextAction = 'Build fresh Android/dev and local-QA PWA from the committed S10 adult native history and truthful collection persistence source. Focused units/static and actual App history/collection failure cases passed. Preserve prior Android7e302703/PWAb13ec20e and frozen iOS83. First-open S03 remains; no stage or release acceptance. Do not rerun unchanged search benchmarks or full suites.';
assert.equal(JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection }), protectedBefore);
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = `<!-- s10-history:begin -->\nAdult native Recently opened and truthful collection persistence are source-validated.\nHistory stores20 canonical references/timestamps through existing OS preferences;\nRUEN labels come from current catalog. Retry/clear handle delayed or failed I/O.\nHistory writer return opens/focuses the existing country sheet on the same globe.\nCollections explicitly report session-only storage when IndexedDB is unavailable;\na remote sync error does not undo a successful local edit.\n${testIds.size} focused units, final static and2 actual App browser cases passed.\nFresh Android/PWA builds follow the source checkpoint. Copy remains draft.\nEvidence: evidence/S10/history-20260908/result.json. First-open S03; S10 in progress.\nChild/aliases/full content/Planetka/device/release gates and frozen iOS83 remain open.\n<!-- s10-history:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const filename = `${base}/${name}`, content = (await fs.readFile(filename, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(content.includes('<!-- s10-history:begin -->'));
  await fs.writeFile(filename, content.replace(/<!-- s10-history:begin -->[\s\S]*?<!-- s10-history:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D099:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D099: Source-validated adult native history reuses OS Preferences and canonical\n  IDs only, with serialized readback, bounded confirmation and authoritative clear.\n  Locale switching and history return retain the existing scene. Local collection\n  durability is a separate status from optional server sync; memory fallback must\n  never claim on-device persistence, and successful local edits survive sync errors.\n  Source browser uses actual App with injected platform primitives. No child scope,\n  editorial approval, installed-device certification or stage acceptance is implied.\n');
const verification = await verifyExecutionFiles(process.cwd());
await fs.writeFile(`${evidence}/source-state-verification.json`, json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, JSON.stringify(verification.errors));
for (const name of ['entry.mjs', 'run-checks.mjs', 'run-browser.mjs', 'source-checkpoint.mjs']) await fs.writeFile(`${evidence}/${name}`, await fs.readFile(`.tmp/s10-history-20260908/${name}`), { flag: 'wx' });
console.log(json({ status: result.status, uniqueUnitPasses: testIds.size, actualBrowserPasses: browsers.length, stateVerification: verification.pass, firstOpen: state.currentCriterionId }));
