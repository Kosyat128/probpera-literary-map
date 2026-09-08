import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyExecutionFiles } from '../../scripts/mobile/verify-state.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S10/search-20260908`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const unit = await read(`${evidence}/unit-a1/result.json`);
const repeated = await read(`${evidence}/unit-types-a1/result.json`);
const staticCheck = await read(`${evidence}/typecheck-a3/result.json`);
const boundaries = await read(`${evidence}/static-a2/result.json`);
const browser = await read(`${evidence}/browser-a6/result.json`);
const bookBrowser = await read(`${evidence}/browser-a8/result.json`);
for (const result of [unit, repeated, staticCheck, boundaries, browser, bookBrowser]) assert.equal(result.pass, true);
assert.equal(unit.tests.passed, 259);
const finalInputs = staticCheck.after;
for (const item of finalInputs) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
for (const item of (await read(`${evidence}/browser-a6/source-inputs.json`)).after) {
  const bytes = await fs.readFile(item.path === 'tests/host/native-planet.spec.mjs' ? `${evidence}/browser-a6/executed-fixture.mjs` : item.path);
  assert.equal(sha(bytes), item.sha256, item.path);
}
const priorFixture = (await fs.readFile(`${evidence}/browser-a6/executed-fixture.mjs`, 'utf8')).replaceAll('\r\n', '\n').trimEnd();
assert.ok((await fs.readFile('tests/host/native-planet.spec.mjs', 'utf8')).replaceAll('\r\n', '\n').startsWith(priorFixture));
for (const item of (await read(`${evidence}/browser-a8/source-inputs.json`)).after) assert.equal(sha(await fs.readFile(item.path)), item.sha256, item.path);
const observation = await read(`${evidence}/browser-a6/native-search-bilingual-complete.json`);
assert.equal(observation.observations.length, 2);
assert.equal(observation.searchFocusDiagnostics, null);
assert.equal(observation.normalMotionWriterFocusPassed, true);
const recordedAt = new Date().toISOString();
const result = { schemaVersion: 1, recordedAt, status: 'SOURCE_VALIDATION_PASSED', stage: 'S10',
  entry: `${evidence}/entry.json`, testedWorkingSourceSha256: sha(json(finalInputs)),
  implementation: ['src/App.tsx', 'src/components/WriterPanel.tsx', 'src/host/host.css', 'src/data/bookSearchAliases.ts', 'src/search/globalSearchIndex.ts',
    'scripts/mobile/build-native.mjs', 'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/verify-native-artifact.mjs', 'scripts/mobile/verify-pwa-artifact.mjs'],
  validation: { uniqueUnitPasses: unit.tests.passed, unitFiles: unit.tests.files,
    repeatedAffectedUnitPasses: repeated.tests.passed, repeatedTestsNotAddedToUniqueTotal: true,
    unitEvidence: ['unit-a1/result.json', 'unit-types-a1/result.json'], typecheckEvidence: 'typecheck-a3/result.json',
    boundaryEvidence: 'static-a2/platform-boundaries.json', boundaryReuse: 'Subsequent changes only remove a local animation wait and scope existing CSS; no imports, scene ownership or adapter boundary changed.',
    actualSourceBrowserPasses: 2, browserEvidence: ['browser-a6/result.json', 'browser-a8/result.json'],
    writerCaseNotRepeatedAfterBookCaseAppend: true,
    failedBrowserExecutionsPreserved: ['browser-a2/result.json', 'browser-a3/result.json'], diagnosticExecutionPreserved: 'browser-a4/result.json', zeroCaseDiscoveryFailure: 'browser-discovery-correction.json',
    correctedTypeFailure: 'test-type-correction.json', correctedTestSheetCycle: 'browser-sheet-cycle-correction.json', correctedBookHeading: 'browser-book-heading-correction.json',
    runtime: ['Canonical mobile globe and catalog; direct writer reveal and visible focus in RU/EN.',
      'Keyboard result activation, Escape focus return, selected country/writer and same Canvas/renderer/camera/scene across locale.',
      'Country search focuses its visible collapsed-sheet control; no manual expansion used to hide writer-search defects.',
      'Both reduced-motion and normal-motion writer selection receive visible focus; final browser run has no source observation transform.',
      'Actual opposite-locale canonical book searches retain localized labels and open the existing reader without replacing the globe.'] },
  canonicalBookAliases: observation.canonicalBookAliases,
  evidenceBoundary: 'These are existing records admitted by the existing source-registry/title policy; no new bibliographic research, translation or human approval was performed.',
  firstOpenCriterion: 'S03.acceptance', stageAccepted: false, releaseReady: false, productionActionsPerformed: false,
  remaining: ['Fresh Android/dev and local-QA PWA artifacts follow the source commit.',
    'Full verified RU/EN/native/transliteration coverage, child isolation, collection/passport and nearly10k capacity remain open.',
    'English content/biographies, edition-specific covers, owner visual content correction, Planetka/full3D and release/legal/device/store gates remain open.',
    'Frozen iOS83 projection remains unchanged and pending approval; there is no new iOS build.'] };
await fs.writeFile(`${evidence}/result.json`, json(result), { flag: 'wx' });
await fs.writeFile(`${evidence}/source-result.json`, json(result), { flag: 'wx' });
const state = await read(`${base}/AUTOPILOT_STATE.json`);
const protectedBefore = JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection });
assert.equal(state.currentCriterionId, 'S03.acceptance');
state.verificationCache.s10Search = { status: result.status, evidence: `${evidence}/result.json`, sha256: sha(json(result)),
  uniqueUnitPasses: unit.tests.passed, sourceBrowserPasses: 2, stageAccepted: false, releaseReady: false };
const stage = state.stages.find(value => value.id === 'S10');
stage.artifacts = [...new Set([...stage.artifacts, `${evidence}/result.json`])];
stage.lastGreenCommands = ['Focused search and artifact regression: 259 unique tests; only two corrected test files repeated.',
  'TypeScript and platform-boundaries: final pass', 'Two actual mobile source-browser search/RUEN/focus/scene and book cases: pass'];
state.updatedAt = recordedAt;
state.resume.nextAction = 'Build fresh Android/dev and controlled local-QA PWA from the committed S10 search source. 259 unique focused tests, final static and two actual mobile RU/EN search/scene and book cases passed; do not replay green suites. Preserve prior Android9af7764d/PWA8521b4e5 and frozen iOS83. First-open remains S03; full S10 alias coverage, child isolation, collection/passport/capacity and all product gates remain open.';
assert.equal(JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, lastGreenCommands, ...value }) => value), ios: state.verificationCache.s04IosGlobeProjection }), protectedBefore);
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = `<!-- s10-search:begin -->\nExisting globe search is source-validated: mobile writer results open their\ncard and receive visible focus; Escape returns to search; RU/EN keep one scene.\nOpposite-locale book titles require existing title/source evidence; canonical\nIDs and current-language labels remain shared. No title or approval generated.\n259 unique tests passed; two type-corrected test files alone were repeated.\nFinal TypeScript/boundaries and two actual mobile RU/EN browser cases passed.\nFailed focus/type/discovery attempts are retained with their corrections.\nFresh Android/PWA build follows this source checkpoint.\nEvidence: evidence/S10/search-20260908/result.json.\nFirst-open S03; S10 in progress. Full alias coverage, child isolation,\ncollection/passport/capacity and release gates open; frozen iOS83 unchanged.\n<!-- s10-search:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const path = `${base}/${name}`, content = (await fs.readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(content.includes('<!-- s10-search:begin -->'));
  await fs.writeFile(path, content.replace(/<!-- s10-search:begin -->[\s\S]*?<!-- s10-search:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n');
assert.ok(!/^- D092:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D092: Real mobile search exposed premature writer focus during inherited\n  hidden-to-visible CSS transitions. The existing app-only reduced-motion\n  exception now covers country sheet descendants, removing the accidental\n  visibility cascade. One cancellable frame consumes the request only after\n  actual focus succeeds; no animation-wait loop remains. Normal motion and\n  public-site behavior are preserved. Opposite-locale title lookup reuses the\n  canonical source authority registry, now hashed in both artifact inputs and\n  explicitly owned by PWA offline bootstrap; no broader root data import is\n  admitted by the native verifier. Existing approval metadata is not new review.\n');
const verification = await verifyExecutionFiles(process.cwd());
await fs.writeFile(`${evidence}/source-state-verification.json`, json(verification), { flag: 'wx' });
assert.equal(verification.pass, true, JSON.stringify(verification.errors));
for (const name of ['entry.mjs', 'run-checks.mjs', 'run-browser.mjs', 'source-checkpoint.mjs']) {
  await fs.writeFile(`${evidence}/${name}`, await fs.readFile(`.tmp/s10-search-20260908/${name}`), { flag: 'wx' });
}
console.log(json({ status: result.status, uniqueUnitPasses: unit.tests.passed, actualSourceBrowserPasses: 2,
  canonicalBookAliases: result.canonicalBookAliases, stateVerification: verification.pass, firstOpen: state.currentCriterionId }));
