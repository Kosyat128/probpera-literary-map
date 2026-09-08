import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateExecution } from '../../scripts/mobile/state.mjs';
import { parseCsv } from '../../scripts/mobile/csv.mjs';
const base = 'docs/mobile', evidence = `${base}/evidence/S06/graphics-quality-20260908`, temp = '.tmp/s06-graphics-quality-20260908';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/u, ''));
const git = args => execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const copies = [];
async function preserve(from, to) {
  const bytes = await fs.readFile(from), destination = `${evidence}/${to}`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes, { flag: 'wx' });
  assert.ok(bytes.equals(await fs.readFile(destination)));
  copies.push({ source: from, path: destination, bytes: bytes.length, sha256: sha(bytes) });
}
async function preserveTree(from, to, history = false) {
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) await preserveTree(`${from}/${entry.name}`, `${to}/${entry.name}`, history);
    else if (/\.(?:json|mjs|png)$/u.test(entry.name) && (!history || !entry.name.endsWith('.png') || entry.name === 'native-graphics-settings-narrow-en.png')) {
      await preserve(`${from}/${entry.name}`, `${to}/${entry.name}`);
    }
  }
}
for (const [from, to] of [['unit-a1', 'quality-units'], ['static-a1', 'history/initial-static'], ['typecheck-a2', 'history/typecheck-ui-fixes'], ['static-a3', 'static'], ['worker-budget-a1', 'worker-budget'], ['selection-a1', 'portrait-selection-initial'], ['selection-a2', 'portrait-selection-final']]) await preserveTree(`${temp}/${from}`, to);
for (const name of ['check-scope-reconciliation.json', 'review.json', 'source-state-verification.json']) await preserve(`${temp}/${name}`, name);
for (const [attempt, to] of [['a1', 'history/browser-a1'], ['a2', 'history/browser-a2'], ['a3', 'browser']]) {
  await preserveTree(`.tmp/s03-graphics-quality-native-20260908-${attempt}/evidence`, to, attempt !== 'a3');
}
const browser = await read(`${evidence}/browser/result.json`);
assert.equal(browser.sourceUnchanged, true); assert.equal(browser.statistics.expected, 1); assert.equal(browser.statistics.unexpected, 0);
const checks = await read(`${temp}/static-a3/result.json`), worker = await read(`${temp}/worker-budget-a1/result.json`), selection = await read(`${temp}/selection-a2/result.json`);
assert.equal(checks.pass, true); assert.equal(worker.pass, true); assert.equal(selection.pass, true);
assert.equal((await read(`${temp}/unit-a1/vitest.json`)).numPassedTests, 103);
assert.equal((await read(`${temp}/selection-a1/vitest.json`)).numPassedTests, 11);
assert.equal((await read(`${temp}/check-scope-reconciliation.json`)).pass, true);
assert.equal((await read(`${temp}/source-state-verification.json`)).pass, true);
for (const file of [...worker.after, ...selection.after]) assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
// The last change after static-a3 is two lines in a Node-only selector/test.
// Neither file belongs to the src TypeScript or platform-boundary graph.
for (const file of checks.after.filter(file => !['scripts/mobile/pwa-portrait-selection.mjs', 'scripts/mobile/pwa-portrait-selection.test.mjs'].includes(file.path))) assert.equal(sha(await fs.readFile(file.path)), file.sha256, file.path);
const portraitsPath = `${base}/evidence/S03/canonical-portraits-20260908/result.json`, portraits = await read(portraitsPath);
assert.equal(portraits.pass, true); assert.equal(portraits.uniqueApprovedLocalFiles, 1011);
assert.equal(sha(await fs.readFile(portraits.selection.path)), portraits.selection.sha256);
const sourceNames = [...new Set(git(['ls-files', '-z', '--modified', '--others', '--exclude-standard', '--', 'src', 'scripts/mobile', 'tests/host', 'tests/pwa']).split('\0').filter(Boolean))].sort();
const sourceFiles = await Promise.all(sourceNames.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const recordedAt = new Date().toISOString();
const result = { schemaVersion: 1, recordedAt, stage: 'S06', status: 'FOCUSED_SOURCE_VALIDATION_PASSED', sourceCheckpointBeforeChanges: git(['rev-parse', 'HEAD']).trim(), sourceFiles,
  scope: 'Live application graphics profiles and retained shared scene; S03 canonical portrait packaging correction encountered during browser validation.',
  implemented: ['High remains the initial owner-selected default independent of resource hints.', 'Manual Balanced/Economy adjust actual DPR, star buffers, sphere/frame detail and sky material without a new Canvas/renderer/camera/atlas.', 'One preference controller preserves latest intent, serializes writes and bounds confirmation at five seconds with truthful retry.', 'Global RU/EN and reduced motion remain independent; settings inherit committed planet surfaces.', 'Native panel header and close control reflow at 320px/200% text; native summary participates in the focus trap.', 'Canonical flag markup preserves browser priority and localized accessible naming.', 'Both local builders use the same exact portrait selection; all current 1011 approved local images are included, with no new image or rights approval.'],
  tests: { uniquePassed: 122, failedFinal: 0, graphicsAndPreferences: 103, workerBudget: 8, portraitSelectionAndArtifactClosure: 11, repeatedFinalSelectorPassesNotDoubleCounted: 6 },
  static: { typeScriptPassed: true, platformBoundariesPassed: true, evidence: 'static/result.json', finalNodeSelectorDelta: 'Case-sensitive canonical prefix enforcement; six helper cases rerun. No src/compiler/boundary input changed after the last static execution.' },
  browser: { evidence: 'browser/result.json', passed: 1, sourceInputsSha256: browser.sourceInputsSha256, actualAppSource: true, nativePluginsSimulated: true, installedRuntimeTested: false, exactArtifactRuntime: false },
  visualReview: { actualImages: ['browser/native-graphics-settings-narrow-ru.png', 'browser/native-graphics-settings-narrow-en.png'], observed: 'Both locales wrap at 320 CSS px/200% root text; language and close controls remain visible; long content scrolls vertically. Six source-browser PNGs retained.' },
  portraits: { evidence: portraitsPath, sha256: sha(await fs.readFile(portraitsPath)), files: 1011, references: 1021, addedFiles: 1003, addedBytes: 27831946, totalBytes: 28089250, newImages: 0, newRightsApprovals: 0 },
  offlineBounds: { maxFiles: 2048, maxFileBytes: 16777216, maxTotalBytes: 67108864, maxMarkerBytes: 524288, onlyFileCountExpanded: true },
  history: ['Initial quality/static wrappers correctly flagged a newline-only change in an unrelated browser fixture; full LF-normalized SHA proves no code difference. Original receipts and scope reconciliation retained.', 'Browser a1 failed on existing React fetchPriority casing; its narrow screenshot also exposed the offscreen return button.', 'Browser a2 failed on missing canonical Russian list portraits. The full current portrait closure was packaged; a3 passed without suppressing console/network errors.', 'The selector received a final uppercase-path refusal fix; only its six tests were repeated.'],
  newNativeArtifactProduced: false, newPwaArtifactProduced: false, copies,
  limitations: ['Graphics settings copy remains draft, not human editorial approval.', 'No full texture/background/Planetka tier completion or physical GPU, FPS, thermal, soak or device acceptance.', 'No full English content/biography coverage, nearly10k catalog acceptance, edition-specific EN cover workflow, store or release acceptance.', 'Fresh Android and actual built-PWA offline verification follow this source checkpoint; historical6611/8609 keep their own identities.'],
  stageAccepted: false, releaseReady: false, productionActionsPerformed: false };
await fs.writeFile(`${evidence}/result.json`, json(result), { flag: 'wx' });
const state = await read(`${base}/AUTOPILOT_STATE.json`), protectedBefore = JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, ...stage }) => stage), ios: state.verificationCache.s04IosGlobeProjection });
assert.equal(state.currentCriterionId, 'S03.acceptance');
state.verificationCache.s06GraphicsQuality = { status: result.status, evidence: `${evidence}/result.json`, sha256: sha(await fs.readFile(`${evidence}/result.json`)), uniqueUnitPasses: 122, sourceBrowserPasses: 1, stageAccepted: false, releaseReady: false };
state.verificationCache.s03CanonicalPortraits = { evidence: portraitsPath, sha256: result.portraits.sha256, files: 1011, addedFiles: 1003, addedBytes: 27831946, sourceInputsCurrent: true, nativeBuildPending: true, pwaBuildPending: true, stageAccepted: false, releaseReady: false };
for (const [id, file] of [['S06', `${evidence}/result.json`], ['S03', portraitsPath]]) {
  const stage = state.stages.find(stage => stage.id === id); stage.artifacts = [...new Set([...stage.artifacts, file])];
}
state.updatedAt = recordedAt;
state.resume.nextAction = 'Build fresh Android/dev and controlled PWA from the committed S06 graphics/current canonical portrait source, then run exactly one built-PWA offline/quality/RUEN case. Preserve prior6611/8609 and frozen iOS83. 122 unique focused tests, final static and one source-browser case passed; do not replay unchanged suites. First-open remains S03. Full English content, nearly10k capacity, edition covers, Planetka, physical-device and release gates remain open.';
assert.equal(JSON.stringify({ head: state.headSha, stages: state.stages.map(({ artifacts, ...stage }) => stage), ios: state.verificationCache.s04IosGlobeProjection }), protectedBefore);
const structural = validateExecution({ state, traceability: await read(`${base}/REQUIREMENTS_TRACEABILITY.json`), mapping: await read(`${base}/STAGE_REQUIREMENT_MAP.json`), sources: parseCsv(await fs.readFile(`${base}/requirements/v12/68_REQUIREMENT_ID_INDEX.csv`, 'utf8')), stageDefinitions: parseCsv(await fs.readFile(`${base}/requirements/v12/69_STAGE_ACCEPTANCE_MATRIX.csv`, 'utf8')), schemas: { state: await read(`${base}/requirements/v12/43_AUTOPILOT_STATE_SCHEMA.json`), traceability: await read(`${base}/requirements/v12/57_REQUIREMENTS_TRACEABILITY_SCHEMA.json`) } });
assert.equal(structural.pass, true, JSON.stringify(structural.errors));
await fs.writeFile(`${evidence}/source-state-structure.json`, json({ ...structural, acceptanceStateUnchanged: true, fullEvidenceCheck: 'source-state-verification.json' }), { flag: 'wx' });
await fs.writeFile(`${base}/AUTOPILOT_STATE.json`, json(state));
const block = `<!-- s06-graphics-quality:begin -->\nHigh/Balanced/Economy implemented and source-validated; High remains default.\nOne Canvas/renderer/camera/atlas and canonical country/writer state retained.\nSaved latest choice, bounded confirmation/retry, RU/EN and reduced motion.\nActual320px/200% text, keyboard and return control passed.\n122 unique focused tests, final TypeScript/boundaries and one source-browser\ncase passed. Initial failed receipts and their actual fixes are preserved.\nS03 packaging fix: same1011 canonical local portraits in native/PWA selection;\n1003 existing files added,27,831,946B. No new artwork or rights approval.\nFresh Android and built-PWA offline verification pending this source commit.\nEvidence: evidence/S06/graphics-quality-20260908/result.json and\nevidence/S03/canonical-portraits-20260908/result.json.\nFirst-open stays S03; S06 is in progress, not accepted. Earlier blocks below\nretain historical source/artifact identities. Full asset/Planetka tiers,\nEnglish coverage, nearly10k/edition cover workflows and device/release gates\nremain open; frozen iOS83 unchanged/pending.\n<!-- s06-graphics-quality:end -->`;
for (const name of ['STATUS.md', 'BLOCKERS.md', 'NEXT_CODEX_PROMPT.txt']) {
  const file = `${base}/${name}`, text = (await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(text.includes('<!-- s06-graphics-quality:begin -->'));
  await fs.writeFile(file, text.replace(/<!-- s06-graphics-quality:begin -->[\s\S]*?<!-- s06-graphics-quality:end -->/u, block));
}
const decisions = (await fs.readFile(`${base}/DECISIONS.md`, 'utf8')).replaceAll('\r\n', '\n'); assert.ok(!/^- D089:/mu.test(decisions));
await fs.writeFile(`${base}/DECISIONS.md`, decisions.trimEnd() + '\n\n- D089: The source-browser quality check exposed incomplete local portrait\n  packaging. Include the full current effective approved canonical closure\n  (1011 files,1021 references), using existing bytes/rights metadata only.\n  Both native and PWA builders share exact portrait pins. Raise the bounded\n  offline file count to2048; keep64MiB total,16MiB per file and512KiB marker\n  limits unchanged. This is S03 package completion for current portraits, not\n  new rights approval, all-content coverage or stage/device acceptance.\n');
await preserve(new URL(import.meta.url), 'source-checkpoint.mjs');
console.log(json({ evidence: `${evidence}/result.json`, uniqueUnitPasses: 122, sourceBrowserPasses: 1, firstOpen: state.currentCriterionId, releaseReady: false }));
