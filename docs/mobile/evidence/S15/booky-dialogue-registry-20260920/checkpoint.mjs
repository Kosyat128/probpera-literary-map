import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

const [sourceCommit, unitAttempt, staticAttempt, inventoryAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, inventoryAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const folder = 'docs/mobile/evidence/S15/booky-dialogue-registry-20260920';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const gitBytes = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { windowsHide: true });
const verify = async file => assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
const entry = await read(folder + '/entry.json');
assert.equal(entry.stage, 'S15'); assert.equal(entry.checkpoint, 'a382b3f5afcbf614c5aaa0a5c38c28ec38a011b8');
assert.equal(git(['rev-parse', 'HEAD']), sourceCommit); git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]);
const sourceRoots = ['src', 'scripts/mobile', 'tests/pwa', 'apps/mobile', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'vite.native.config.ts', 'capacitor.config.json', 'native.html'];
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', ...sourceRoots]), '');
const addedFiles = [...entry.newImplementationFiles, ...entry.unitFiles.filter(file => !entry.protectedFiles.some(prior => prior.path === file))].sort();
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit, '--', ...sourceRoots]).split(/\r?\n/u).sort(),
  addedFiles.map(file => 'A\t' + file));
for (const file of entry.protectedFiles) await verify(file);
for (const file of entry.checkpointFiles) await verify(file);
await verify(entry.previous); const prior = await read(entry.previous.path); assert.equal(prior.pass, true);
assert.equal(prior.sourceCommit, entry.priorSourceCommit);
const runs = {}, attempts = { unit: unitAttempt, static: staticAttempt, inventory: inventoryAttempt };
let sourceManifest;
for (const [mode, attempt] of Object.entries(attempts)) {
  const reportPath = `${folder}/${mode}-${attempt}/result.json`, report = await read(reportPath);
  assert.equal(report.pass, true); assert.equal(report.mode, mode); assert.equal(report.attempt, attempt);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  assert.equal(report.stageAccepted, false); assert.equal(report.reviewedDialogueAccepted, false); assert.equal(report.releaseReady, false);
  await verify(report.sourceManifest); const manifest = await read(report.sourceManifest.path);
  assert.equal(manifest.files.length, report.sourceManifest.fileCount);
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
const inventoryPath = `${folder}/inventory-${inventoryAttempt}/inventory.json`, inventory = await read(inventoryPath);
assert.equal(inventory.pass, true); assert.deepEqual(inventory.errors, []);
assert.equal(inventory.recordCount, 12); assert.deepEqual(inventory.locales, ['ru', 'en']);
assert.equal(inventory.notReviewedCount, 12);
for (const key of ['approvedCount', 'availableAdultCount', 'availableChildCount']) assert.equal(inventory[key], 0, key);
for (const file of inventory.sourceInputs) await verify(file);
await verify(inventory.sourceFile);
const earlierAttempts = [];
for (const [mode, finalAttempt] of Object.entries(attempts)) for (let index = 1; index < Number(finalAttempt.slice(1)); index++) {
  const file = `${folder}/${mode}-a${index}/result.json`;
  try { const report = await read(file); await verify(report.sourceManifest);
    const execution = await read(`${folder}/${mode}-a${index}/execution.json`); await verify(execution.stdout); await verify(execution.stderr);
    earlierAttempts.push({ ...await ref(file), mode, attempt: report.attempt, pass: report.pass, tests: report.tests,
      sourceManifest: report.sourceManifest, reason: 'Original report retained. Only the selected final source-bound reports support current validation.' });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const retainedBuilds = [];
for (const build of entry.priorBuilds) {
  await verify(build.priorResult); await verify(build.artifactManifest);
  const manifest = await read(build.artifactManifest.path);
  assert.equal(manifest.buildId, build.buildId); assert.equal(manifest.sourceCommit, entry.priorSourceCommit);
  for (const file of manifest.sourceInputs.files) await verify(file);
  for (const file of manifest.inventory) await verify({ path: path.join(path.dirname(build.artifactManifest.path), file.path), sha256: file.sha256 });
  if (build.apk) await verify(build.apk);
  retainedBuilds.push({ ...build, runtimeSourceInputsUnchanged: true, runtimePayloadRehashed: true,
    newRegistryCodeIncluded: false, rebuilt: false, sourceFileCount: manifest.sourceInputs.files.length,
    runtimeFileCount: manifest.inventory.length });
}
const globals = ['docs/mobile/AUTOPILOT_STATE.json', 'docs/mobile/DECISIONS.md', 'docs/mobile/STATUS.md',
  'docs/mobile/BLOCKERS.md', 'docs/mobile/NEXT_CODEX_PROMPT.txt', 'docs/mobile/REQUIREMENTS_TRACEABILITY.json', 'docs/mobile/REQUIREMENTS_TRACEABILITY.csv'];
const original = new Map(await Promise.all(globals.map(async file => [file, await fs.readFile(file, 'utf8')])));
const state = JSON.parse(original.get(globals[0])), trace = JSON.parse(original.get(globals[5]));
const stage = state.stages.find(stage => stage.id === 'S15'), criterion = stage.criteria.find(item => item.id === 'S15.PLANETKA-003');
const requirement = trace.requirements.find(item => item.id === 'PLANETKA-003');
assert.equal(stage.status, 'IN_PROGRESS'); assert.equal(criterion.status, 'OPEN'); assert.equal(requirement.status, 'OPEN');
assert.equal(state.headSha, entry.priorSourceCommit); assert.equal(state.currentCriterionId, 'S03.acceptance');
assert.equal(state.verificationCache.s15BookyDialogueRegistry, undefined);
assert.equal(/^- D156:/mu.test(original.get(globals[1])), false);
const recordedAt = new Date().toISOString(), resultPath = folder + '/result.json';
const nextAction = 'Continue S15 with guarded, versioned literary journey definitions using canonical public country/writer/work IDs and reviewed dialogue references. Resolve public visibility and precise entity relations before exposing a route; unknown policy, missing or unreviewed content stays unavailable. Keep production journeys draft until content and rights are genuinely reviewed. Then expand the dialogue inventory to existing navigation and contextual lines. Preserve adult progress, explicit resume/reset, offline recovery and all canonical scene ownership. Child profiles, age-adaptive full journeys, reviewed text/audio, installed-device, accessibility, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.';
const result = { schemaVersion: 1, recordedAt, stage: 'S15', status: 'ADULT_BOOKY_DIALOGUE_REGISTRY_BOUNDARY_VALIDATED', sourceCommit,
  pass: true, entry: await ref(folder + '/entry.json'), previous: entry.previous, checkpointHelper: await ref(fileURLToPath(import.meta.url)),
  sourceManifest, runs, earlierAttempts, units: await ref(unitPath), unitCount: cases.length, inventory: await ref(inventoryPath),
  recordCount: 12, notReviewedCount: 12, approvedCount: 0, availableAdultCount: 0, availableChildCount: 0,
  unchangedExistingFileCount: entry.protectedFiles.length, existingRuntimeInputsUnchanged: true, retainedBuilds,
  buildsRebuilt: false, registryIncludedInBuilds: false, browserRerun: false, runtimeWiringImplemented: false,
  criterionChanges: [{ id: 'S15.PLANETKA-003', from: 'OPEN', to: 'IN_PROGRESS' }],
  requirementChanges: [{ id: 'PLANETKA-003', from: 'OPEN', to: 'IN_PROGRESS' }],
  firstUnresolved: 'S03.acceptance', nextAction,
  limitations: ['The registry and draft inventory are not connected to the application renderer. Existing adult interface help stays unchanged.',
    'All twelve existing RU/EN support messages remain not-reviewed. Checksums prove consistency, not editorial approval or source truth.',
    'Approved test fixtures are synthetic and confer no production review, license or child approval.',
    'The preserved PWA/Android artifacts retain their prior source identity. Their existing source inputs and copied payloads are rehashed; the new unimported registry is not included.',
    'No child journeys, narration playback, content publication, device, accessibility, iOS or release acceptance is claimed.'],
  reviewedDialogueAccepted: false, childApproved: false, narrationEnabled: false, stageAccepted: false,
  productionActionsPerformed: false, releaseReady: false };
const push = (list, value) => { if (!list.includes(value)) list.push(value); };
const scopedNote = ' Adult dialogue registry infrastructure now validates version/checksum, context, age, entity, review and rights boundaries. Twelve existing support-copy locale records remain not-reviewed and unavailable through the reviewed-dialogue resolver. ' + cases.length + ' tests, TypeScript and the fixed-inventory audit passed. Existing runtime remains unchanged; this does not complete reviewed dialogue or child/narration scope.';
for (const item of [criterion, requirement]) { item.status = 'IN_PROGRESS'; item.commit = sourceCommit; item.notes += scopedNote; push(item.evidence, resultPath); }
criterion.lastValidatedAt = recordedAt;
for (const file of entry.newImplementationFiles) push(requirement.implementationFiles, file);
for (const file of entry.unitFiles) push(requirement.tests, file);
for (const file of [folder + '/entry.json', resultPath, folder + '/README.md', sourceManifest.path, inventoryPath, ...Object.values(runs).map(run => run.path)]) push(stage.artifacts, file);
for (const [mode, attempt] of Object.entries(attempts)) push(stage.lastGreenCommands, `node ${folder}/check.mjs ${mode} ${attempt}`);
state.headSha = sourceCommit; state.updatedAt = recordedAt; state.resume.nextAction = nextAction; push(state.resume.contextFiles, resultPath);
push(state.resume.doNotRepeat, 'S15 dialogue registry boundary and fixed inventory of 12 RU/EN support drafts: zero reviewed/available records, existing runtime unchanged. Retained builds still bind prior source 5e6eb767. Continue canonical journey definitions without inferring content, child or rights approval.');
state.verificationCache.s15BookyDialogueRegistry = { path: resultPath, sha256: sha(json(result)),
  sourceCommit, status: result.status, stageAccepted: false, releaseReady: false };
const marker = '<!-- s15-booky-dialogue-20260920:begin -->';
const note = marker + '\nSource ' + sourceCommit.slice(0, 8) + ': strict adult dialogue validation and inventory for 12 existing RU/EN support messages. All remain not-reviewed; no production dialogue is approved or enabled.\n' + cases.length + ' unit tests, TypeScript and fixed inventory passed. ' + entry.protectedFiles.length + ' existing files remain exact. Prior PWA a44b4440 / Android-dev 5c3287a7 were rehashed with their original source identity; new registry code is unimported and not included in those builds.\nOnly S15.PLANETKA-003 and global PLANETKA-003 advance OPEN to IN_PROGRESS. Stage counts remain 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/booky-dialogue-registry-20260920/result.json.\n' + nextAction + '\n<!-- s15-booky-dialogue-20260920:end -->\n\n';
const readme = '# S15 Booky dialogue registry boundary\n\n' + scopedNote.trim() + '\n\nSource: ' + sourceCommit + '. All 12 records are drafts derived from existing interface copy; no literary facts, child access or human approval are inferred. The registry is deliberately unimported by the current application.\n\nEvidence: [result.json](result.json), selected unit/static/inventory attempts, fixed source hashes and rehashed preserved PWA/Android payloads. No new build or browser execution is claimed for unchanged runtime.\n\nNext: ' + nextAction + '\n';
const rows = parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv', 'utf8'));
assert.equal(original.get(globals[6]).replaceAll('\r\n', '\n'), projectTraceabilityCsv(JSON.parse(original.get(globals[5])), rows));
const updates = new Map([[globals[0], json(state)], [globals[1], original.get(globals[1]) + '\n- D156: ' + scopedNote.trim() + ' Existing runtime, canonical scene and Booky visuals remain unchanged. Retained PWA/Android artifacts bind previous source ' + entry.priorSourceCommit + '; their source and payload hashes are rechecked, but no registry runtime inclusion or new build is claimed. Only PLANETKA-003 advances OPEN to IN_PROGRESS; S03.acceptance remains first unresolved. Evidence: evidence/S15/booky-dialogue-registry-20260920/result.json.\n'],
  ...globals.slice(2, 5).map(file => [file, note + original.get(file)]), [globals[5], json(trace)], [globals[6], projectTraceabilityCsv(trace, rows)]]);
for (const [file, contents] of original) assert.equal(await fs.readFile(file, 'utf8'), contents, file);
await fs.writeFile(resultPath, json(result), { flag: 'wx' }); await fs.writeFile(folder + '/README.md', readme, { flag: 'wx' });
for (const [file, contents] of updates) await fs.writeFile(file, contents);
console.log(json({ pass: true, sourceCommit, unitCount: cases.length, recordCount: 12, approvedCount: 0,
  existingFilesUnchanged: entry.protectedFiles.length, retainedBuilds: retainedBuilds.map(build => build.buildId), releaseReady: false }));
