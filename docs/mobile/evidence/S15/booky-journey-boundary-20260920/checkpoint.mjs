import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

const [sourceCommit, unitAttempt, staticAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const folder = 'docs/mobile/evidence/S15/booky-journey-boundary-20260920';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true });
const verify = async file => assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S15');
assert.equal(entry.checkpoint, '15216398df20301f138f3715b113a94ca028968c');
assert.equal(entry.priorSourceCommit, '35e01e02b377c3cd05cc2d6dc7c137a54f528297');
assert.deepEqual(entry.newImplementationFiles, ['src/host/bookyJourney.ts']);
assert.deepEqual([...entry.unitFiles].sort(), ['src/host/bookyDialogueRegistry.test.ts', 'src/host/bookyJourney.test.ts']);
assert.equal(git(['rev-parse', 'HEAD']), sourceCommit); git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]);
const sourceRoots = ['src', 'scripts/mobile', 'tests/pwa', 'apps/mobile', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'vite.native.config.ts', 'capacitor.config.json', 'native.html'];
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', ...sourceRoots]), '');
const addedFiles = [...entry.newImplementationFiles, ...entry.unitFiles.filter(file => !entry.protectedFiles.some(prior => prior.path === file))].sort();
assert.deepEqual(addedFiles, ['src/host/bookyJourney.test.ts', 'src/host/bookyJourney.ts']);
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit, '--', ...sourceRoots]).split(/\r?\n/u).sort(),
  addedFiles.map(file => 'A\t' + file));
for (const file of entry.protectedFiles) await verify(file);
for (const file of entry.checkpointFiles) await verify(file);
await verify(entry.previous); const prior = await read(entry.previous.path); assert.equal(prior.pass, true);
assert.equal(prior.sourceCommit, entry.priorSourceCommit);
assert.equal(prior.status, 'ADULT_BOOKY_DIALOGUE_REGISTRY_BOUNDARY_VALIDATED');
const runs = {}, attempts = { unit: unitAttempt, static: staticAttempt };
let sourceManifest;
for (const [mode, attempt] of Object.entries(attempts)) {
  const reportPath = `${folder}/${mode}-${attempt}/result.json`, report = await read(reportPath);
  assert.equal(report.pass, true); assert.equal(report.mode, mode); assert.equal(report.attempt, attempt);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  for (const key of ['stageAccepted', 'ageAdaptiveJourneysAccepted', 'reviewedDialogueAccepted', 'childApproved', 'runtimeWiringImplemented', 'releaseReady']) assert.equal(report[key], false, key);
  await verify(report.sourceManifest); const manifest = await read(report.sourceManifest.path);
  assert.equal(manifest.files.length, report.sourceManifest.fileCount);
  assert.deepEqual(manifest.files.map(file => file.path).sort(), [...new Set([...entry.protectedFiles.map(file => file.path), ...addedFiles])].sort());
  for (const file of manifest.files) await verify(file);
  for (const file of addedFiles) {
    const input = manifest.files.find(input => input.path === file); assert.ok(input, file);
    assert.equal(sha(gitBytes(['show', sourceCommit + ':' + file])), input.sha256, 'Committed source: ' + file);
  }
  for (const file of report.checkInputs) await verify(file);
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest); else sourceManifest = report.sourceManifest;
  const executionPath = `${folder}/${mode}-${attempt}/execution.json`, execution = await read(executionPath);
  assert.equal(execution.exitCode, 0); await verify(execution.stdout); await verify(execution.stderr);
  runs[mode] = { ...await ref(reportPath), tests: report.tests, execution: await ref(executionPath) };
}
const unitPath = `${folder}/unit-${unitAttempt}/vitest.json`, units = await read(unitPath);
const normalized = file => path.resolve(file).replaceAll('\\', '/');
assert.deepEqual(units.testResults.map(file => normalized(file.name)).sort(), entry.unitFiles.map(normalized).sort());
const cases = units.testResults.flatMap(file => file.assertionResults);
assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.deepEqual(runs.unit.tests, { passed: cases.length, failed: 0, skipped: 0 });
const earlierAttempts = [];
for (const [mode, finalAttempt] of Object.entries(attempts)) for (let index = 1; index < Number(finalAttempt.slice(1)); index++) {
  const file = `${folder}/${mode}-a${index}/result.json`;
  try {
    const report = await read(file); await verify(report.sourceManifest);
    const execution = await read(`${folder}/${mode}-a${index}/execution.json`); await verify(execution.stdout); await verify(execution.stderr);
    earlierAttempts.push({ ...await ref(file), mode, attempt: report.attempt, pass: report.pass, tests: report.tests,
      sourceManifest: report.sourceManifest, reason: 'Original report retained. Only the selected final source-bound reports support current validation.' });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.deepEqual(entry.priorBuilds.map(build => build.kind).sort(), ['android', 'pwa']);
assert.deepEqual(prior.retainedBuilds.map(build => build.kind).sort(), ['android', 'pwa']);
const retainedBuilds = [];
for (const build of entry.priorBuilds) {
  const previousBuild = prior.retainedBuilds.find(item => item.kind === build.kind); assert.ok(previousBuild);
  for (const key of ['buildId', 'sourceCommit', 'priorResult', 'artifactManifest', 'apk']) assert.deepEqual(build[key], previousBuild[key], key);
  await verify(build.priorResult); await verify(build.artifactManifest);
  const priorBuildResult = await read(build.priorResult.path), manifest = await read(build.artifactManifest.path);
  assert.equal(priorBuildResult.pass, true); assert.equal(priorBuildResult.buildId, build.buildId);
  assert.equal(priorBuildResult.sourceCommit, build.sourceCommit);
  assert.equal(manifest.buildId, build.buildId); assert.equal(manifest.sourceCommit, build.sourceCommit);
  assert.equal(build.sourceCommit, '5e6eb7676367f71731fa84f9b2e69249c48bcb06');
  for (const file of manifest.sourceInputs.files) await verify(file);
  for (const file of manifest.inventory) await verify({ path: path.join(path.dirname(build.artifactManifest.path), file.path), sha256: file.sha256 });
  if (build.apk) await verify(build.apk);
  retainedBuilds.push({ ...build, runtimeSourceInputsUnchanged: true, runtimePayloadRehashed: true,
    newJourneyCodeIncluded: false, rebuilt: false, sourceFileCount: manifest.sourceInputs.files.length,
    runtimeFileCount: manifest.inventory.length });
}
const globals = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md',
  'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/REQUIREMENTS_TRACEABILITY.json', 'docs/mobile/REQUIREMENTS_TRACEABILITY.csv'];
const original = new Map(await Promise.all(globals.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(original.get(globals[0])), trace = JSON.parse(original.get(globals[5]));
const stage = state.stages.find(stage => stage.id === 'S15'), criterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-004');
const requirement = trace.requirements.find(item => item.id === 'PLANETKA-004');
assert.equal(stage.status, 'IN_PROGRESS'); assert.equal(criterion.status, 'OPEN'); assert.equal(requirement.status, 'OPEN');
assert.equal(state.headSha, entry.priorSourceCommit); assert.equal(state.currentCriterionId, 'S03.acceptance');
assert.equal(state.verificationCache.s15BookyJourneyBoundary, undefined);
assert.equal(/^- D157:/mu.test(original.get(globals[1])), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const nextAction = 'Continue S15 by expanding the fixed, unreviewed RU/EN dialogue inventory for the two existing adult navigation routes and contextual guidance. Preserve exact copy provenance, versioned checksums and draft status. Then prepare guarded runtime integration with explicit public-entity, review and host-policy checks; missing or unreviewed content stays unavailable. Preserve all current adult navigation, semantic progress, explicit resume/reset, unsupported-save protection, offline recovery and canonical scene ownership. Do not automatically publish content or infer editorial, child, narration or age-adaptive journey approval. Full literary journeys, accessibility, installed-device/performance, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.';
const result = { schemaVersion: 1, recordedAt, stage: 'S15', status: 'BOOKY_CANONICAL_JOURNEY_BOUNDARY_VALIDATED', sourceCommit,
  pass: true, entry: await ref(folder + '/entry.json'), previous: entry.previous, checkpointHelper: await ref(fileURLToPath(import.meta.url)),
  sourceManifest, runs, earlierAttempts, units: await ref(unitPath), unitCount: cases.length,
  unchangedExistingFileCount: entry.protectedFiles.length, existingRuntimeInputsUnchanged: true, retainedBuilds,
  buildsRebuilt: false, journeyIncludedInBuilds: false, browserRerun: false, runtimeWiringImplemented: false,
  criterionChanges: [{ id: 'S15.PLANETKA-004', from: 'OPEN', to: 'IN_PROGRESS' }],
  requirementChanges: [{ id: 'PLANETKA-004', from: 'OPEN', to: 'IN_PROGRESS' }],
  firstUnresolved: 'S03.acceptance', nextAction,
  limitations: ['The journey model is not imported by the application. Existing navigation routes, progress, support and scene behavior stay unchanged.',
    'This validates a model boundary, not a production journey inventory, age adaptation or educational effectiveness.',
    'Synthetic reviewed fixtures prove admission checks only and confer no human review, license or child approval on production content.',
    'Existing dialogue copy remains draft; no new production dialogue is approved, published or enabled.',
    'Retained PWA/Android artifacts keep source 5e6eb767. Their original source inputs and copied payloads are rehashed; new unimported journey code is not included.',
    'No new browser run, child scenario, narration playback, installed-device, accessibility, iOS or release acceptance is claimed.'],
  ageAdaptiveJourneysAccepted: false, productionJourneysEnabled: false, reviewedDialogueAccepted: false,
  childApproved: false, narrationEnabled: false, stageAccepted: false, productionActionsPerformed: false, releaseReady: false };
const push = (list, value) => { if (!list.includes(value)) list.push(value); };
const scopedNote = ' Guarded versioned journey-model infrastructure now validates canonical public entity relations, dialogue references and explicit host policy before admission. ' + cases.length + ' journey/registry tests and TypeScript passed. The model stays unimported and production journeys remain unavailable. Existing runtime is unchanged; this starts infrastructure for the requirement and does not complete age-adaptive or child journeys.';
for (const item of [criterion, requirement]) { item.status = 'IN_PROGRESS'; item.commit = sourceCommit; item.notes += scopedNote; push(item.evidence, resultPath); }
criterion.lastValidatedAt = recordedAt;
for (const file of entry.newImplementationFiles) push(requirement.implementationFiles, file);
for (const file of entry.unitFiles) push(requirement.tests, file);
for (const file of [folder + '/entry.json', resultPath, folder + '/README.md', sourceManifest.path, ...Object.values(runs).map(run => run.path)]) push(stage.artifacts, file);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
state.headSha = sourceCommit; state.updatedAt = recordedAt; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 canonical journey model boundary: source-bound unit/static checks, existing runtime unchanged, zero production journey activation. Retained PWA/Android builds still bind 5e6eb767. Continue the two existing adult-route draft dialogue inventory, then guarded runtime integration without inferring review, child or age-adaptive acceptance.');
state.verificationCache.s15BookyJourneyBoundary = { path: resultPath, sha256: sha(json(result)),
  sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
const marker = '<!-- s15-booky-journey-20260920:begin -->';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ': guarded canonical journey model with versioned dialogue and policy boundaries. The model stays unimported; production journeys, child scenarios and age adaptation are not enabled or accepted.\n' + cases.length + ' journey/registry unit tests and TypeScript passed. ' + entry.protectedFiles.length + ' existing files remain exact. Retained PWA a44b4440 / Android-dev 5c3287a7 were rehashed against their original source 5e6eb767; no rebuild or new browser run is claimed.\nOnly S15.PLANETKA-004 and global PLANETKA-004 advance OPEN to IN_PROGRESS. Stage counts remain 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/booky-journey-boundary-20260920/result.json.\n' + nextAction + '\n<!-- s15-booky-journey-20260920:end -->\n\n';
const readme = '# S15 Booky canonical journey boundary\n\n' + scopedNote.trim() + '\n\nSource: ' + sourceCommit + '. No production journey inventory, reviewed literary dialogue, child access or age-adaptive acceptance is inferred. The model remains unimported by the application.\n\nEvidence: [result.json](result.json), selected unit/static attempts, fixed source hashes and rehashed retained PWA/Android payloads. Those builds retain source 5e6eb767; no new build or browser execution is claimed.\n\nNext: ' + nextAction + '\n';
const rows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(JSON.parse(original.get(globals[5])), rows));
const updates = new Map([[globals[0], json(state)], [globals[1], original.get(globals[1]) + '\n- D157: ' + scopedNote.trim() + ' Existing runtime, canonical scene, Booky dialogue drafts and visuals remain unchanged. Retained PWA/Android artifacts bind original source 5e6eb7676367f71731fa84f9b2e69249c48bcb06; source and payload hashes are rechecked without claiming journey inclusion, rebuild or browser coverage. Only PLANETKA-004 advances OPEN to IN_PROGRESS; S03.acceptance remains first unresolved. Evidence: evidence/S15/booky-journey-boundary-20260920/result.json.\n'],
  ...globals.slice(2, 5).map(file => [file, note + original.get(file)]), [globals[5], json(trace)], [globals[6], projectTraceabilityCsv(trace, rows)]]);
for (const [file, contents] of original) assert.equal(await fs.readFile(file, 'utf8'), contents, file);
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(folder + '/README.md', readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount: cases.length, existingFilesUnchanged: entry.protectedFiles.length,
  retainedBuilds: retainedBuilds.map(build => ({ buildId: build.buildId, sourceCommit: build.sourceCommit })),
  productionJourneysEnabled: false, ageAdaptiveJourneysAccepted: false, releaseReady: false }));
