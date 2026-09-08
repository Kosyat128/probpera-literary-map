import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/capacity-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const unit = await read(`${evidence}/unit-a1/result.json`);
const asyncUnit = await read(`${evidence}/unit-async-a1/result.json`);
const staticCheck = await read(`${evidence}/static-a2/result.json`);
const browser = await read(`${evidence}/browser-a2/result.json`);
const hooks = await read(`${evidence}/hook-browser-a1/result.json`);
const benchmark = await read(`${evidence}/benchmark-a1/result.json`);
for (const result of [unit, asyncUnit, staticCheck, browser, hooks, benchmark]) assert.equal(result.pass, true);
const finalInputs = staticCheck.after;
for (const item of finalInputs) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
for (const folder of ['browser-a2', 'hook-browser-a1']) {
  for (const item of (await read(`${evidence}/${folder}/source-inputs.json`)).after) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
}
assert.equal(sha(await fs.readFile('src/utils/literarySearch.ts')), benchmark.currentEngineSha256);
const testIds = new Set();
let totalTestExecutions = 0;
for (const folder of ['unit-a1', 'unit-async-a1']) {
  const report = await read(`${evidence}/${folder}/vitest.json`);
  for (const file of report.testResults) for (const test of file.assertionResults) {
    assert.equal(test.status, 'passed');
    testIds.add(file.name.replaceAll('\\', '/') + ':' + test.fullName);
    totalTestExecutions++;
  }
}
const recordedAt = new Date().toISOString();
const result = { schemaVersion: 1, recordedAt, status: 'SOURCE_VALIDATION_PASSED', stage: 'S10',
  entry: `${evidence}/entry.json`, testedWorkingSourceSha256: sha(json(finalInputs)),
  implementation: ['src/App.tsx', 'src/utils/literarySearch.ts', 'src/utils/prepareSearchIndex.ts', 'src/search/globalSearchIndex.ts', 'src/search/globalSearchRuntime.ts', 'src/search/usePreparedSearchIndex.ts'],
  validation: { uniqueUnitPasses: testIds.size, totalTestExecutions, repeatedAffectedPasses: totalTestExecutions - testIds.size,
    unitEvidence: ['unit-a1/result.json', 'unit-async-a1/result.json'], staticEvidence: 'static-a2/result.json',
    actualBrowserPasses: 2, sourceBrowserEvidence: ['browser-a2/result.json', 'hook-browser-a1/result.json'],
    earlierSourceBrowser: 'browser-a1/result.json; passed compiled search before async refinement and retained as historical evidence',
    unchangedCompiledEngineBenchmarkReused: true,
    runtime: ['Canonical mobile book search resolves four existing RU/EN published-title pairs and preserves the same globe/selection.',
      'The mounted React hook uses the actual batching helper and a synthetic10000-row fixture; host tasks interleave, superseded locale/unmount cancel, stale rows are hidden and retry works.',
      'Shared runtime tests retain single same-key promise, abort stale preparation and protect the new cache from obsolete completions.'] },
  capacity: { fixture: benchmark.fixture, count: benchmark.count, corpusSha256: benchmark.corpusSha256,
    baselineRef: benchmark.baselineRef, engineSha256: benchmark.currentEngineSha256, evidence: 'benchmark-a1/result.json',
    modes: benchmark.modes.map(({ measurements, ...value }) => value), allRankedKeyAndScoreDigestsEqual: true,
    preparationRefinement: 'The measured synchronous823ms preparation is now scheduled in initial/between-batch host tasks, with8ms budget and100 iterator/mapper operations per batch. This is cooperative scheduling, not an installed-device FPS claim.',
    boundaries: [...benchmark.limits, 'Rank digests compare score/key order, not full UI label/suggestion sorting.', 'Heap delta is added prepared data while the raw fixture remains resident.'] },
  canonicalDataChanged: false, newEditorialApprovalCreated: false,
  firstOpenCriterion: 'S03.acceptance', stageAccepted: false, releaseReady: false, productionActionsPerformed: false,
  remaining: ['Fresh Android/dev and local-QA PWA artifacts follow the source commit.',
    'Publication gate currently admits four books; synthetic10000 capacity does not add or verify a production catalog.',
    'Full native/transliteration alias evidence, child isolation, collection/passport, English biographies/content, edition covers/owner correction workflow, Planetka and device/store/legal/release gates remain open.',
    'Frozen iOS83 unchanged and pending; no new iOS build.'] };
await fs.writeFile(`${evidence}/result.json`, json(result), { flag: 'wx' });
await fs.writeFile(`${evidence}/source-result.json`, json(result), { flag: 'wx' });
const state = await read(`${base}/AUTOPILOT_STATE.json`);
const protectedBefore = JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection });
assert.equal(state.currentCriterionId, 'S03.acceptance');
state.verificationCache.s10SearchCapacity = { status: result.status, evidence: `${evidence}/result.json`, sha256: sha(json(result)),
  uniqueUnitPasses: testIds.size, sourceBrowserPasses: 2, syntheticCapacity: 10000, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(value => value.id === 'S10');
stage.artifacts = [...new Set([...stage.artifacts, `${evidence}/result.json`])];
stage.lastGreenCommands = [`Focused search/async preparation: ${testIds.size} unique unit passes; only newly affected suites repeated.`,
  'Final TypeScript and platform-boundaries: pass', 'Actual mobile globe book RUEN plus mounted React10000-row race/cancellation browser: 2 pass', 'Exact-baseline synthetic10000-row core benchmark: pass'];
state.updatedAt = recordedAt;
state.resume.nextAction = 'Build fresh Android/dev and controlled local-QA PWA from the committed S10 compiled/cooperative search source. Final units/static and two affected actual-browser cases passed; exact engine benchmark retained without repetition. Preserve prior Android40d1a1b5/PWAa22183b0 and frozen iOS83. First-open remains S03; no production catalog capacity/content/device/stage acceptance.';
assert.equal(JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection }), protectedBefore);
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = `<!-- s10-capacity:begin -->\nCompiled search and cooperative index preparation are source-validated.\nSynthetic10000: atlas median795.845→6.908ms, shared-fields940.917→6.292ms;\nall matched keys/scores agree with exact prior engine. This is desktop engine\ncapacity, not production catalog/device certification. Initial and between-batch\nhost yields replace the measured~823ms monolithic preparation; stale builds abort.\n${testIds.size} unique units, final static and2 actual-browser cases passed.\nFresh Android/PWA build follows this source checkpoint.\nEvidence: evidence/S10/capacity-20260908/result.json. First-open S03; S10 in progress.\nFull content/child/alias/collection/device gates open; frozen iOS83 unchanged.\n<!-- s10-capacity:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const filename = `${base}/${name}`, content = (await fs.readFile(filename, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(content.includes('<!-- s10-capacity:begin -->'));
  await fs.writeFile(filename, content.replace(/<!-- s10-capacity:begin -->[\s\S]*?<!-- s10-capacity:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D095:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D095: Exact-baseline synthetic10000 search measurements preserve all scored\n  keys and show large query savings, but expose~823ms synchronous preparation.\n  Prepare the existing atlas/shared indexes through cooperative8ms/100-operation\n  batches with an initial host yield. Generator construction also yields for\n  hidden records; obsolete locale/revision work aborts. Commit no mixed-locale\n  index, retain retry and one current shared promise. Browser lifecycle evidence\n  uses explicitly synthetic records; canonical book/globe evidence remains\n  separate. No production catalog, memory/FPS/device or stage acceptance follows.\n');
const verification = await verifyExecutionFiles(process.cwd());
await fs.writeFile(`${evidence}/source-state-verification.json`, json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, JSON.stringify(verification.errors));
for (const name of ['entry.mjs', 'run-checks.mjs', 'run-browser.mjs', 'run-hook-browser.mjs', 'source-checkpoint.mjs']) await fs.writeFile(`${evidence}/${name}`, await fs.readFile(`.tmp/s10-capacity-20260908/${name}`), { flag: 'wx' });
console.log(json({ status: result.status, uniqueUnitPasses: testIds.size, actualBrowserPasses: 2, stateVerification: verification.pass, firstOpen: state.currentCriterionId }));
