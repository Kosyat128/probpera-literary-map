import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Run only after committing the three source files and selecting matching
// unit/static/inventory reports. This records evidence; it runs no checks/builds.
const [sourceCommit, unitAttempt, staticAttempt, inventoryAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, inventoryAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/navigation-rebaseline-20260923';
const normalized = file => path.resolve(file).replaceAll('\\', '/');
assert.equal(normalized(await fs.realpath('.')), root);
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const verify = async item => { assert.match(item.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path); };
const verifyRef = async item => { await verify(item); return read(item.path); };
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const noApproval = (item, keys = ['stageAccepted', 'releaseReady']) => { for (const key of keys) assert.equal(item[key], false, key); };
const sourceRoots = ['src', 'scripts/mobile', 'tests/pwa', 'apps/mobile', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'vite.native.config.ts', 'vite.pwa.config.ts', 'capacitor.config.json', 'native.html'];
const clean = () => { assert.equal(git(['rev-parse', 'HEAD']), sourceCommit); assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', ...sourceRoots]), ''); };
const entry = await read(folder + '/entry.json'), changed = entry.changedPaths;
assert.deepEqual(changed.slice().sort(), ['scripts/mobile/verify-booky-navigation-drafts.mjs', 'src/host/bookyNavigationDrafts.test.ts', 'src/host/bookyNavigationDrafts.ts']);
assert.deepEqual(entry.newSourcePaths, []); assert.deepEqual(entry.newImplementationFiles, []);
assert.equal(entry.unitFiles.length, 3); assert.equal(entry.stage, 'S15'); noApproval(entry); assert.equal(entry.childApproved, false);
assert.equal(git(['rev-parse', sourceCommit + '^']), entry.checkpoint); clean();
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(), changed.map(file => 'M\t' + file).sort());
assert.equal(entry.previousCheckpointResult.path, entry.previous);
const prior = await verifyRef(entry.previousCheckpointResult), baseline = await verifyRef(entry.priorSourceManifest);
assert.equal(prior.pass, true); noApproval(prior); assert.deepEqual(prior.sourceManifest, entry.priorSourceManifest);
assert.equal(prior.sourceCommit, entry.runtimeSourceCommit); assert.equal(entry.runtimeSourceCommit, 'c5f8e80ab3b8f6be42e04584a0b174ac427197e7');
assert.equal(baseline.files.length, 1598); assert.equal(entry.priorSourceManifest.fileCount, 1598);
const baselineMap = new Map(baseline.files.map(item => [item.path, item.sha256])); assert.equal(baselineMap.size, 1598);
const protectedFiles = baseline.files.filter(item => !changed.includes(item.path)); assert.equal(protectedFiles.length, 1595);
for (const item of [...protectedFiles, ...entry.checkpointFiles]) await verify(item);

const attempts = { unit: unitAttempt, static: staticAttempt, inventory: inventoryAttempt }, runs = {}, earlierAttempts = [];
let sourceManifest, sourceFiles;
for (const [mode, attempt] of Object.entries(attempts)) {
  const file = `${folder}/${mode}-${attempt}/result.json`, report = await read(file);
  assert.equal(report.pass, true); assert.equal(report.mode, mode); assert.equal(report.attempt, attempt);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  assert.equal(report.runtimeUnchanged, true); noApproval(report, ['runtimeWiringImplemented', 'stageAccepted', 'ageAdaptiveJourneysAccepted', 'reviewedDialogueAccepted', 'childApproved', 'releaseReady']);
  const manifest = await verifyRef(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, 1598); assert.equal(report.sourceManifest.fileCount, 1598);
  assert.deepEqual(manifest.files.map(item => item.path).sort(), baseline.files.map(item => item.path).sort());
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else {
    sourceManifest = report.sourceManifest; sourceFiles = manifest.files;
    for (const item of sourceFiles) {
      await verify(item);
      if (changed.includes(item.path)) assert.equal(sha(gitBytes(['show', sourceCommit + ':' + item.path])), item.sha256, 'Committed changed input: ' + item.path);
      else assert.equal(item.sha256, baselineMap.get(item.path), 'Protected input: ' + item.path);
    }
  }
  for (const item of report.checkInputs) await verify(item);
  const executionPath = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionPath);
  assert.equal(execution.exitCode, 0); await verify(execution.stdout); await verify(execution.stderr);
  const rawName = mode === 'unit' ? 'vitest.json' : mode === 'inventory' ? 'inventory.json' : null;
  if (mode !== 'unit') assert.equal(report.tests, null);
  runs[mode] = { ...await ref(file), tests: report.tests, execution: await ref(executionPath),
    rawReport: rawName ? await ref(`${folder}/${mode}-${attempt}/${rawName}`) : null };
  for (let n = 1; n < Number(attempt.slice(1)); n++) {
    const oldPath = `${folder}/${mode}-a${n}/result.json`;
    let old; try { old = await read(oldPath); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await verify(old.sourceManifest); const executionPath = `${folder}/${mode}-a${n}/execution.json`, oldExecution = await read(executionPath);
    await verify(oldExecution.stdout); await verify(oldExecution.stderr);
    earlierAttempts.push({ ...await ref(oldPath), mode, attempt: 'a' + n, pass: old.pass, tests: old.tests,
      sourceManifest: old.sourceManifest, execution: await ref(executionPath),
      rawReport: rawName ? await ref(`${folder}/${mode}-a${n}/${rawName}`) : null,
      reason: mode === 'inventory' && n === 1 ? 'Original stale Controls source hash reproduced. All 22 runtime-copy checks passed; only SOURCE_BYTES_CHANGED failed. This original report is retained unchanged.'
        : 'Original report retained; selected matching source reports alone support this checkpoint.' });
  }
}
const sourceMap = new Map(sourceFiles.map(item => [item.path, item.sha256]));
const units = await verifyRef(runs.unit.rawReport), cases = units.testResults.flatMap(item => item.assertionResults);
assert.deepEqual(units.testResults.map(item => normalized(item.name)).sort(), entry.unitFiles.map(normalized).sort());
assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.deepEqual([units.numPassedTests, units.numFailedTests, units.numPendingTests], [cases.length, 0, 0]);
assert.deepEqual(runs.unit.tests, { passed: cases.length, failed: 0, skipped: 0 });

const failed = await read(folder + '/inventory-a1/result.json'), oldInventory = await read(folder + '/inventory-a1/inventory.json');
assert.equal(failed.pass, false); assert.equal(failed.execution.exitCode, 1); assert.equal(failed.sourceInputsUnchanged, true);
assert.ok(earlierAttempts.some(item => item.mode === 'inventory' && item.attempt === 'a1' && item.pass === false));
assert.equal(oldInventory.pass, false); assert.deepEqual(oldInventory.errors, [{ code: 'SOURCE_BYTES_CHANGED', record: 'src/host/PlanetMascotControls.tsx' }]);
assert.ok(oldInventory.records.length === 22 && oldInventory.records.every(item => item.runtimeTextMatches === true));
const inventory = await verifyRef(runs.inventory.rawReport);
assert.equal(inventory.schemaVersion, 1); assert.equal(inventory.kind, 'booky-navigation-draft-inventory'); assert.equal(inventory.pass, true); assert.deepEqual(inventory.errors, []);
for (const [key, value] of Object.entries({ recordCount: 22, navigationRecordCount: 14, contextualRecordCount: 8, combinedRecordCount: 34,
  draftCount: 22, notReviewedCount: 22, combinedDraftCount: 34, approvedCount: 0, availableAdultCount: 0, availableChildCount: 0 })) assert.equal(inventory[key], value, key);
noApproval(inventory, ['changesExistingHelp', 'narrationEnabled', 'childApproved', 'humanReviewed', 'factualEditorialEvidenceClaimed', 'stageAccepted', 'releaseReady']);
assert.deepEqual(inventory.sources.map(item => item.sourcePath).sort(), ['src/host/PlanetMascotControls.tsx', 'src/host/planetMascotRoutes.ts']);
for (const item of [...inventory.sourceFiles, ...inventory.sourceInputs]) await verify(item);
const routesPath = 'src/host/planetMascotRoutes.ts', controlsPath = 'src/host/PlanetMascotControls.tsx';
const routesSource = inventory.sources.find(item => item.sourcePath === routesPath), controlsSource = inventory.sources.find(item => item.sourcePath === controlsPath);
assert.deepEqual(routesSource, oldInventory.sources.find(item => item.sourcePath === routesPath));
assert.equal(routesSource.sourceVersion, 1); assert.equal(routesSource.sourceCommit, '5e6eb7676367f71731fa84f9b2e69249c48bcb06');
assert.equal(controlsSource.sourceVersion, 2); assert.equal(controlsSource.sourceCommit, entry.runtimeSourceCommit);
assert.equal(controlsSource.sourceSha256, sha((await fs.readFile(controlsPath, 'utf8')).replaceAll('\r\n', '\n')));
assert.equal(controlsSource.sourceHashEncoding, 'sha256:utf8:lf'); assert.equal(controlsSource.copyHashEncoding, 'sha256:utf8:JSON.stringify({title,body})');
const key = item => item.id + ':' + item.locale;
assert.deepEqual(inventory.records.map(key).sort(), oldInventory.records.map(key).sort());
const contextualChanges = [];
for (const record of inventory.records) {
  const old = oldInventory.records.find(item => key(item) === key(record)); assert.ok(old);
  assert.equal(record.status, 'draft'); assert.equal(record.copySha256, old.copySha256);
  for (const name of ['runtimeTextMatches', 'contentChecksumMatches', 'recordChecksumMatches']) assert.equal(record[name], true);
  for (const name of ['reviewedDialogueAvailable', 'childDialogueAvailable']) assert.equal(record[name], false);
  if (record.id.startsWith('navigation.')) {
    assert.equal(record.sourceVersion, 1); assert.equal(record.sourceCommit, routesSource.sourceCommit);
    for (const name of Object.keys(old)) assert.deepEqual(record[name], old[name], key(record) + ':' + name);
  } else {
    assert.match(record.id, /^guidance\.(globe|country|writer|collection)$/u); assert.equal(old.version, 1); assert.equal(record.version, 2);
    assert.equal(record.sourceVersion, 2); assert.equal(record.sourceCommit, entry.runtimeSourceCommit);
    assert.equal(record.sourceSha256, controlsSource.sourceSha256);
    for (const name of Object.keys(old).filter(name => !['version', 'sourceSha256'].includes(name))) assert.deepEqual(record[name], old[name], key(record) + ':' + name);
    contextualChanges.push({ id: record.id, locale: record.locale, priorVersion: 1, version: 2,
      copySha256: record.copySha256, priorSourceSha256: old.sourceSha256, sourceSha256: record.sourceSha256 });
  }
}
assert.equal(contextualChanges.length, 8);
const summaryPath = folder + '/rebaseline-summary.json', summary = await read(summaryPath);
assert.equal(summary.schemaVersion, 1); assert.equal(summary.kind, 'explicit-navigation-provenance-rebaseline-draft');
assert.equal(summary.sourceCommit, entry.runtimeSourceCommit);
// This is the unchanged preparation handoff. Applied evidence comes from the
// current committed file hashes and selected reports, not rewritten flags.
assert.equal(summary.appliedToRepository, false); assert.equal(summary.testsRun, false); assert.equal(summary.auditRun, false);
assert.deepEqual(summary.contextualSource.before, oldInventory.sources.find(item => item.sourcePath === controlsPath));
assert.deepEqual(summary.contextualSource.after, controlsSource);
for (const [name, value] of Object.entries({ changedRecordCount: 8, unchangedRouteRecordCount: 14, unchangedSupportRecordCount: 12,
  combinedCopyUnchangedCount: 34, approvedCount: 0 })) assert.equal(summary[name], value, name);
for (const name of ['navigationCopyEqual', 'routeRecordsExact', 'allDraft']) assert.equal(summary[name], true);
noApproval(summary, ['humanReviewed', 'childApproved', 'narrationApproved', 'releaseReady']);
assert.deepEqual(summary.files.map(item => item.path).sort(), changed.slice().sort());
for (const item of summary.files) { assert.equal(item.beforeSha256, baselineMap.get(item.path)); assert.equal(item.afterSha256, sourceMap.get(item.path)); }
assert.equal(summary.preservedSupport.path, 'src/host/bookyDialogueDrafts.ts'); await verify(summary.preservedSupport);
assert.equal(summary.preservedSupport.sha256, baselineMap.get(summary.preservedSupport.path));
assert.deepEqual(summary.records.map(key).sort(), contextualChanges.map(key).sort());
const draftSource = await fs.readFile('src/host/bookyNavigationDrafts.ts', 'utf8');
for (const item of summary.records) {
  const record = inventory.records.find(record => key(record) === key(item)); assert.equal(item.copyEqual, true);
  assert.equal(item.before.payloadVersion, 1); assert.equal(item.before.sourceVersion, 1);
  assert.equal(item.after.payloadVersion, 2); assert.equal(item.after.sourceVersion, 2);
  assert.equal(item.before.sourceSha256, summary.contextualSource.before.sourceSha256); assert.equal(item.after.sourceSha256, controlsSource.sourceSha256);
  assert.equal(item.before.copySha256, record.copySha256); assert.equal(item.after.copySha256, record.copySha256);
  assert.equal(item.after.sourceRef, item.before.sourceRef.replace(summary.contextualSource.before.sourceCommit + ':', entry.runtimeSourceCommit + ':'));
  for (const name of ['contentChecksum', 'checksum']) {
    assert.match(item.before[name], /^[a-f0-9]{64}$/u); assert.match(item.after[name], /^[a-f0-9]{64}$/u);
    assert.notEqual(item.before[name], item.after[name]); assert.ok(draftSource.includes(JSON.stringify(item.after[name])));
  }
}

// Prior reader tests and source Chrome evidence are retained, never rerun here.
const retainedValidation = { sourceCommit: prior.sourceCommit, unit: prior.runs.unit, browser: prior.runs.browser,
  unitCount: 353, browserCases: 2, unitRerun: false, browserRerun: false };
for (const [mode, reference] of [['unit', prior.runs.unit], ['browser', prior.runs.browser]]) {
  const report = await verifyRef(reference); assert.equal(report.pass, true); assert.deepEqual(report.sourceManifest, entry.priorSourceManifest);
  const execution = await verifyRef(reference.execution); assert.equal(execution.exitCode, 0); await verify(execution.stdout); await verify(execution.stderr);
  const raw = await verifyRef(reference.rawReport);
  if (mode === 'unit') {
    const priorCases = raw.testResults.flatMap(item => item.assertionResults); assert.equal(priorCases.length, 353); assert.ok(priorCases.every(item => item.status === 'passed'));
    assert.deepEqual(report.tests, { passed: 353, failed: 0, skipped: 0 });
  } else { assert.deepEqual(report.tests, { passed: 2, failed: 0, skipped: 0, flaky: 0 }); assert.deepEqual(raw.errors, []); }
}
for (const item of prior.actualAppCaptures) await verify(item);
const retainedBuilds = [];
for (const [kind, reference, prefix] of [['pwa', entry.priorPwa, 'ec2dd9dd'], ['android', entry.priorAndroid, '91837818']]) {
  assert.deepEqual(reference, prior[kind]); const build = await verifyRef(reference);
  assert.equal(build.pass, true); assert.equal(build.sourceCommit, entry.runtimeSourceCommit); assert.ok(build.buildId.startsWith(prefix)); noApproval(build);
  const artifactManifest = { path: build.artifact.path + '/artifact.json', sha256: build.artifact.artifactSha256 ?? build.artifact.sha256 };
  const manifest = await verifyRef(artifactManifest); assert.equal(manifest.sourceCommit, build.sourceCommit); assert.equal(manifest.buildId, build.buildId);
  assert.equal(manifest.sourceInputs.sha256, build.sourceInputsSha256);
  const sourceInventoryDifferences = [];
  for (const item of manifest.sourceInputs.files) {
    if (changed.includes(item.path)) {
      assert.equal(item.path, 'src/host/bookyNavigationDrafts.ts'); assert.equal(item.sha256, baselineMap.get(item.path));
      sourceInventoryDifferences.push({ path: item.path, artifactSourceSha256: item.sha256, currentSourceSha256: sourceMap.get(item.path), unimportedDraftInventory: true });
    } else await verify(item);
  }
  assert.equal(sourceInventoryDifferences.length, 1);
  for (const item of manifest.inventory) {
    const file = path.join(build.artifact.path, item.path), bytes = await fs.readFile(file); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, file);
  }
  if (build.apk) { await verify(build.apk); assert.equal((await fs.stat(build.apk.path)).size, build.apk.bytes); }
  retainedBuilds.push({ kind, priorResult: reference, artifactManifest, apk: build.apk ?? null, sourceCommit: build.sourceCommit,
    buildId: build.buildId, runtimePayloadRehashed: true, sourceInventoryDifferences, unchangedOtherCapturedSourceInputs: true,
    navigationRebaselineIncluded: false, rebuilt: false });
}

const globals = ['AUTOPILOT_STATE.json', 'DECISIONS.md', 'STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt',
  'REQUIREMENTS_TRACEABILITY.json', 'REQUIREMENTS_TRACEABILITY.csv'].map(file => 'docs/mobile/' + file);
const original = new Map(await Promise.all(globals.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(original.get(globals[0])), trace = JSON.parse(original.get(globals[5])), beforeTrace = structuredClone(trace);
const statuses = () => state.stages.map(stage => [stage.id, stage.status, stage.criteria.map(item => [item.id, item.status])]), beforeStatuses = statuses();
const counts = Object.fromEntries(['COMPLETE', 'IN_PROGRESS', 'NOT_STARTED'].map(status => [status, state.stages.filter(item => item.status === status).length]));
assert.deepEqual(counts, { COMPLETE: 3, IN_PROGRESS: 12, NOT_STARTED: 26 }); assert.equal(state.headSha, prior.sourceCommit);
assert.equal(state.currentStageId, 'S03'); assert.equal(state.currentCriterionId, 'S03.acceptance'); assert.equal(state.resume.firstOpenCriterion, 'S03.acceptance');
assert.deepEqual(entry.requirements, ['PLANETKA-003']);
const stage = state.stages.find(item => item.id === 'S15'), criterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-003');
const requirement = trace.requirements.find(item => item.id === 'PLANETKA-003');
for (const item of [stage, criterion, requirement]) assert.equal(item.status, 'IN_PROGRESS');
assert.equal(state.verificationCache.s15BookyReaderPolicy.path, entry.previous); await verify(state.verificationCache.s15BookyReaderPolicy);
assert.equal(state.verificationCache.s15BookyNavigationRebaseline, undefined);
assert.equal([...original.get(globals[1]).matchAll(/^- D162:/gmu)].length, 1); assert.equal(/^- D163:/mu.test(original.get(globals[1])), false);
const marker = '<!-- s15-navigation-rebaseline-20260923:begin -->';
for (const file of globals.slice(2, 5)) assert.equal(original.get(file).includes(marker), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json', readmePath = folder + '/README.md';
const nextAction = 'Continue guarded Booky journey integration under the explicit local adult reader policy, current catalogs and fresh immutable host sources. The 34 RU/EN inventory records remain draft; require independent exact-version review receipts before enabling production dialogue or journeys. Preserve App-owned drafts, explicit save/delete intent, semantic navigation progress, scene ownership and offline recovery. Child profiles, approved text/audio, full journeys, accessibility, installed-device/performance, iOS and release acceptance remain pending; S03.acceptance is first unresolved.';
const limitations = [
  'Only draft inventory declarations, their test and the read-only audit change. No App, controller, renderer, storage, locale or interface copy changes are included.',
  'Eight contextual RU/EN payloads and source provenance advance to version 2 for the current Controls source. Their copy stays exact; fourteen navigation records and twelve support records remain unchanged. All 34 records remain draft and unavailable to the reviewed-dialogue resolver.',
  'The preserved failed inventory-a1 proves one stale whole-file Controls hash, with all 22 runtime-text checks passing. A source hash and payload checksum establish identity, not editorial review, facts, rights or approval.',
  'The retained 353 reader tests and two actual-App Chrome cases belong to source ' + entry.runtimeSourceCommit + '; they are historical evidence and were not rerun for this inventory-only repair.',
  'Retained PWA/Android payloads and APK bytes are rehashed at their original runtime source. Their broad source manifests include the previous unimported navigation inventory file; that explicit inventory-only difference is recorded rather than claiming every captured source hash matches current files.',
  'No rebuild, new browser run, reviewed production dialogue/journey, narration, child access, installed-device, accessibility, iOS, stage or release acceptance is claimed.',
];
const result = { schemaVersion: 1, recordedAt, sourceCommit, stage: 'S15', status: 'BOOKY_NAVIGATION_DRAFT_PROVENANCE_REBASELINE_VALIDATED', pass: true,
  entry: await ref(folder + '/entry.json'), previous: entry.previousCheckpointResult, checkpointHelper: await ref(folder + '/checkpoint.mjs'),
  sourceManifest, runs, attempts, earlierAttempts, unitFiles: entry.unitFiles, unitCount: cases.length, inventory: runs.inventory.rawReport,
  rebaselineSummary: await ref(summaryPath), contextualChanges, recordCount: 22, navigationRecordCount: 14, contextualRecordCount: 8,
  combinedRecordCount: 34, combinedDraftCount: 34, approvedCount: 0, availableAdultCount: 0, availableChildCount: 0,
  unchangedTrackedInputCount: 1595, protectedInputsVerified: true, changedSourcePaths: changed, changedSourceGitBlobCount: 3,
  protectedSourceAuthority: entry.priorSourceManifest, retainedValidation, retainedBuilds, buildsRebuilt: false, browserRerun: false,
  runtimeUnchanged: true, runtimeWiringImplemented: false, navigationRebaselineIncludedInBuilds: false,
  criterionChanges: [], requirementChanges: [], stageChanges: [], allStageAndCriterionStatusesUnchanged: true, counts,
  firstUnresolved: 'S03.acceptance', decisionD163Recorded: true, nextAction, limitations,
  reviewedDialogueAccepted: false, productionJourneysEnabled: false, ageAdaptiveJourneysAccepted: false, childApproved: false,
  narrationEnabled: false, stageAccepted: false, productionActionsPerformed: false, releaseReady: false };
const scoped = ' Repaired the stale contextual draft provenance after the Controls integration: eight RU/EN contextual payload/source versions now explicitly advance to 2 with identical copy; fourteen navigation and twelve support records remain exact. All 34 remain draft. ' + cases.length + ' selected unit tests, TypeScript and the read-only source inventory audit passed; original inventory-a1 failure is preserved. Runtime code is unchanged; 353 prior reader tests and 2 actual-App Chrome cases are retained without rerun. PWA ec2dd9dd / Android-dev 91837818 remain at source c5f8e80a, with preserved runtime/APK bytes rehashed and the old unimported inventory source hash explicitly distinguished. No rebuild or stage/release acceptance.';
const push = (items, value) => { if (!items.includes(value)) items.push(value); };
for (const item of [criterion, requirement]) { item.commit = sourceCommit; item.notes += scoped; push(item.evidence, resultPath); }
criterion.lastValidatedAt = recordedAt;
for (const file of changed.filter(file => !file.endsWith('.test.ts'))) push(requirement.implementationFiles, file);
for (const file of entry.unitFiles) push(requirement.tests, file);
for (const file of [folder + '/entry.json', resultPath, readmePath, summaryPath, sourceManifest.path, ...Object.values(runs).map(item => item.path)]) push(stage.artifacts, file);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
state.updatedAt = recordedAt; state.headSha = sourceCommit; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 contextual inventory provenance explicitly rebased to current Controls with eight version-2 drafts and unchanged copy;14 navigation/12 support records remain exact. Original stale-hash regression preserved; runtime/builds unchanged and all34 records still draft.');
state.verificationCache.s15BookyNavigationRebaseline = { path: resultPath, sha256: sha(json(result)), sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
assert.deepEqual(statuses(), beforeStatuses); assert.deepEqual(trace.requirements.map(item => [item.id, item.status]), beforeTrace.requirements.map(item => [item.id, item.status]));
assert.deepEqual(trace.requirements.filter(item => item.id !== 'PLANETKA-003'), beforeTrace.requirements.filter(item => item.id !== 'PLANETKA-003'));
const rows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(beforeTrace, rows));
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ':' + scoped + '\nPLANETKA-003 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/navigation-rebaseline-20260923/result.json.\n' + nextAction + '\n<!-- s15-navigation-rebaseline-20260923:end -->\n\n';
const updates = new Map([[globals[0], json(state)], [globals[1], original.get(globals[1]) + '\n- D163: Source ' + sourceCommit + scoped + ' Evidence: evidence/S15/navigation-rebaseline-20260923/result.json.\n'],
  ...globals.slice(2, 5).map(file => [file, note + original.get(file)]), [globals[5], json(trace)], [globals[6], projectTraceabilityCsv(trace, rows)]]);
await assert.rejects(fs.stat(resultPath), { code: 'ENOENT' }); await assert.rejects(fs.stat(readmePath), { code: 'ENOENT' }); clean();
for (const [file, bytes] of original) assert.equal(await fs.readFile(file, 'utf8'), bytes, file + ': changed during preflight');
await fs.writeFile(resultPath, json(result), { flag: 'wx' });
await fs.writeFile(readmePath, '# S15 contextual draft provenance rebaseline\n\nSource: ' + sourceCommit + '.\n\n' + scoped.trim() + '\n\n' + limitations.map(item => '- ' + item).join('\n') + '\n\nNext: ' + nextAction + '\n', { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount: cases.length, contextualVersionsUpdated: 8, combinedDraftCount: 34,
  protectedInputs: 1595, retainedReaderUnitCount: 353, retainedAppCases: 2, counts, firstOpen: 'S03.acceptance', releaseReady: false, result: resultPath }));
