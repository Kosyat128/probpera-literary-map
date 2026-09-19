import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

const [mode, attempt = 'a1', ...extra] = process.argv.slice(2);
assert.ok(['unit', 'static', 'browser'].includes(mode));
assert.equal(extra.length, 0);
assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const evidence = 'docs/mobile/evidence/S13/ceramic-portraits-20260920';
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-cer';
const out = evidence + '/' + mode + '-' + attempt;
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

const unitFiles = [
  'src/components/globeCeramicPortraitStandGeometry.test.ts',
  'src/planet/globeCeramicPortraitStandPolicy.test.ts',
];
const expectedUnitCases = 4, expectedBrowserCases = 1;
const adapterFiles = [
  'src/host/HostPlatformServices.test.ts',
  'src/platform/adapters/web/WebPlatformAdapter.test.ts',
];
const adapterTitles = [
  'round-trips only exact adult stand choices through the stand preference key',
  'round-trips only exact adult stand choices without extending browser storage authority',
];
const adapterPattern = 'round-trips only exact adult stand choices (?:through the stand preference key|without extending browser storage authority)$';
const runtimeInputs = [
  'src/components/globeCeramicPortraitStandGeometry.ts',
  'src/components/globeWhaleStandGeometry.ts', 'src/components/globeAntiqueGeometry.ts',
  'src/components/globeStandGeometry.ts', 'src/components/globeTurnedWoodAtlas.ts',
  'src/components/globeCraftMaterials.ts', 'src/components/globeQuality.ts',
  'src/components/globeLibraryGeometry.ts', 'src/components/globeLibraryBookGeometry.ts',
  'src/components/globeEditions.ts', 'src/planet/editions.ts', 'src/planet/baseEditionPolicy.ts',
  'src/planet/globeStands.ts', 'src/planet/globeBackgrounds.ts', 'src/planet/globeComposition.ts',
  'src/host/planetComposition.ts', 'src/host/planetCompositionPresentation.ts',
  'src/components/useGlobeCompositionScene.ts', 'src/components/useGlobeCompositionFrame.ts',
  'src/components/globeAtlas.ts', 'src/components/globeAssetCache.ts', 'src/components/useGlobeStyleState.ts',
  'src/App.tsx', 'src/components/LiteraryWorldMap.tsx', 'src/components/LiteraryGlobe.tsx',
  'src/components/GlobeIncludedStand.tsx', 'src/components/GlobeIncludedBackground.tsx',
  'src/host/PlanetStandControls.tsx', 'src/host/PlanetStandControls.css',
  'src/host/PlanetEditionPreferenceStatus.tsx', 'src/host/planetGraphicsQuality.ts',
  'src/host/PlanetGraphicsSettings.tsx', 'src/host/mountHostApp.tsx',
  'src/host/HostPlatformServices.ts', 'src/platform/adapters/web/WebPlatformAdapter.ts',
  'src/platform/adapters/android/AndroidPlatformAdapter.ts', 'src/platform/ports.ts',
  'src/platform/PlatformServices.tsx', 'src/platform/distribution.ts',
  'src/utils/safeWebStorage.ts', 'src/i18n/InterfaceLanguage.tsx',
  'src/index.css', 'src/host/host.css', 'src/host/planetAppearance.css',
];
// Bind the scoped runtime in every mode, but only the executed mode's test and
// configuration sources. A later browser assertion edit must not relabel an old
// unit/static run or require repeating valid checks of unchanged runtime.
const commonInputs = [...runtimeInputs, 'package.json', 'package-lock.json', 'tsconfig.json', evidence + '/run-checks.mjs'];
const modeInputs = {
  unit: [...unitFiles, ...adapterFiles, evidence + '/unit.config.mjs',
    'docs/mobile/requirements/v12/37_BASE_EDITION_STARTER_SET.csv'],
  static: [...unitFiles, ...adapterFiles],
  browser: ['tests/pwa/globe-ceramic-portraits.spec.mjs', evidence + '/playwright.config.mjs',
    evidence + '/capture-portraits.mjs', 'scripts/mobile/native-base-assets.json'],
};
// Missing promoted inputs are errors; do not discover through Git and silently
// omit new untracked source. Capture and fixture hashes are not pinned here.
const inputs = [...new Set([...commonInputs, ...modeInputs[mode]])].sort();
const snapshot = () => Promise.all(inputs.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const before = await snapshot();
const sourceBase = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
await fs.mkdir(out, { recursive: true });
await fs.mkdir(artifactRoot + '/temp', { recursive: true });
const startedAt = new Date().toISOString();
const browserReport = path.resolve(out, 'playwright.json');
const unitReport = path.resolve(out, 'vitest.json');
const adapterReport = path.resolve(out, 'vitest-adapters.json');
const commands = mode === 'unit' ? [
  ['unit', ['node_modules/vitest/vitest.mjs', 'run', '--config=' + evidence + '/unit.config.mjs', ...unitFiles, '--maxWorkers=2', '--reporter=json', '--outputFile=' + unitReport]],
  ['adapter-allowlists', ['node_modules/vitest/vitest.mjs', 'run', '--config=' + evidence + '/unit.config.mjs', ...adapterFiles, '--testNamePattern=' + adapterPattern,
    '--maxWorkers=2', '--reporter=json', '--outputFile=' + adapterReport]],
] : mode === 'static' ? [['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']]]
  : [['browser', ['node_modules/@playwright/test/cli.js', 'test', '--config=' + evidence + '/playwright.config.mjs']]];
const executions = [];
for (const [name, args] of commands) {
  const streams = { stdout: [], stderr: [] }, began = Date.now(), executionStartedAt = new Date().toISOString();
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, TEMP: artifactRoot + '/temp', TMP: artifactRoot + '/temp', S13_ATTEMPT: attempt, S13_MODE: mode, S13_UNIT_SELECTION: name,
      S13_BROWSER_REPORT: browserReport, S13_BROWSER_OUTPUT: artifactRoot + '/' + mode + '-' + attempt,
      S13_BROWSER_PROFILE_ROOT: artifactRoot + '/profiles',
    } });
    for (const key of Object.keys(streams)) child[key].on('data', bytes => streams[key].push(bytes));
    child.on('error', reject); child.on('close', resolve);
  });
  const record = { command: [process.execPath, ...args], startedAt: executionStartedAt, durationMs: Date.now() - began, exitCode,
    logs: Object.fromEntries(Object.entries(streams).map(([key, chunks]) => {
      const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), sha256: sha(bytes) }];
    })) };
  await fs.writeFile(out + '/' + name + '.json', json(record), { flag: 'wx' });
  executions.push({ name, exitCode, durationMs: record.durationMs });
}
const after = await snapshot(), unchanged = json(before) === json(after);
let tests = null;
const reportErrors = [];
try {
  if (mode === 'unit') {
    const main = JSON.parse(await fs.readFile(unitReport, 'utf8'));
    const adapters = JSON.parse(await fs.readFile(adapterReport, 'utf8'));
    const mainCases = main.testResults.flatMap(file => file.assertionResults);
    assert.equal(mainCases.length, expectedUnitCases, 'exactly four intended ceramic unit cases must be present');
    assert.equal(main.testResults.length, unitFiles.length, 'only the two ceramic test files may execute');
    const normalizePath = value => value.replaceAll('\\', '/');
    assert.deepEqual(main.testResults.map(file => normalizePath(file.name)).sort(), unitFiles.map(file => root + '/' + file).sort());
    assert.equal(adapters.testResults.length, adapterFiles.length, 'only the two filtered adapter files may execute');
    assert.deepEqual(adapters.testResults.map(file => normalizePath(file.name)).sort(), adapterFiles.map(file => root + '/' + file).sort());
    const cases = adapters.testResults.flatMap(file => file.assertionResults);
    const selected = cases.filter(test => new RegExp(adapterPattern, 'u').test(test.fullName));
    const excluded = cases.filter(test => !new RegExp(adapterPattern, 'u').test(test.fullName));
    assert.equal(selected.length, adapterTitles.length, 'exactly two intended adapter cases must be present');
    for (const title of adapterTitles) assert.equal(selected.filter(test => test.fullName.endsWith(title)).length, 1, title);
    assert.ok(excluded.every(test => ['pending', 'skipped', 'todo', 'disabled'].includes(test.status)), 'unselected adapter tests must not execute');
    const adapterPassed = selected.filter(test => test.status === 'passed').length;
    const adapterFailed = selected.filter(test => test.status === 'failed').length;
    const adapterSkipped = selected.length - adapterPassed - adapterFailed;
    const failures = [...main.testResults.flatMap(file => file.assertionResults), ...selected]
      .filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages }));
    tests = { passed: main.numPassedTests + adapterPassed, failed: main.numFailedTests + adapterFailed,
      skipped: main.numPendingTests + adapterSkipped, filteredOut: excluded.length, failures,
      selectedAdapterCases: selected.map(test => ({ name: test.fullName, status: test.status })),
      selection: { unitFiles, expectedUnitCases, adapterFiles, adapterPattern, expectedAdapterCases: adapterTitles.length },
      filterAccounting: 'Unmatched adapter cases are intentionally excluded, recorded as filteredOut, and never counted as passed. Skipped refers to selected tests only.' };
    assert.equal(tests.passed + tests.failed + tests.skipped, expectedUnitCases + adapterTitles.length);
  } else if (mode === 'browser') {
    const report = JSON.parse(await fs.readFile(browserReport, 'utf8'));
    tests = { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped,
      flaky: report.stats.flaky, errors: report.errors };
    assert.equal(tests.passed + tests.failed + tests.skipped + tests.flaky, expectedBrowserCases, 'exactly one ceramic browser case must execute');
  }
} catch (error) { reportErrors.push(String(error?.message ?? error)); }
const testsPassed = mode === 'static' || (tests !== null && tests.failed === 0 && tests.skipped === 0
  && (mode !== 'browser' || (tests.flaky === 0 && tests.errors.length === 0)));
const result = { schemaVersion: 1, mode, startedAt, endedAt: new Date().toISOString(), sourceBase,
  sourceInputs: before, sourceInputsUnchanged: unchanged, sourceInputScope: 'Shared scoped runtime and only the executed mode test/configuration inputs', executions, tests, reportErrors,
  pass: unchanged && executions.every(item => item.exitCode === 0) && reportErrors.length === 0 && testsPassed,
  ownerAdditions: ['stand.base.portrait-pushkin', 'stand.base.portrait-hemingway', 'stand.base.portrait-tolstoy'],
  likenessAccepted: false, artAccepted: false, releaseReady: false, deviceTested: false, productionActivation: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({ mode, pass: result.pass, tests, executions, reportErrors, result: out + '/result.json' }));
if (!result.pass) process.exitCode = 1;
