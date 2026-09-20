import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

// Three selected inspection suites, one browser fixture, or TypeScript. Runtime source
// hashes share an immutable manifest; mode-specific harness hashes stay small.
const [mode, attempt, ...extra] = process.argv.slice(2);
assert.ok(['unit', 'static', 'browser'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/stand-inspection-20260920', out = `${folder}/${mode}-${attempt}`;
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-stand-inspection';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, env: process.env }).trim();
const entry = await read(folder + '/entry.json'); assert.match(entry.checkpoint, /^[a-f0-9]{40}$/u);
const prior = await read(entry.previous), priorReportBytes = await fs.readFile(prior.runs.browser.path);
assert.equal(sha(priorReportBytes), prior.runs.browser.sha256);
const priorReport = JSON.parse(priorReportBytes); assert.equal(priorReport.pass, true);
const priorManifestBytes = await fs.readFile(priorReport.sourceManifest.path);
assert.equal(sha(priorManifestBytes), priorReport.sourceManifest.sha256);
assert.deepEqual(priorReport.sourceManifest, prior.sourceManifest);
const priorManifest = JSON.parse(priorManifestBytes);
assert.equal(priorManifest.schemaVersion, 1); assert.equal(priorManifest.files.length, priorReport.sourceManifest.fileCount);
const runtimePath = file => file.startsWith('src/') && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file);
const relevant = ['src/components/globeStandInspection.ts', 'src/host/planetStandInspection.ts', 'src/App.tsx',
  'src/components/GlobeCameraRig.tsx', 'src/components/globeFocusMath.ts', 'src/components/GlobeIncludedStand.tsx',
  'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx', 'src/host/PlanetStandControls.tsx', 'src/host/PlanetStandControls.css',
  'package.json', 'package-lock.json', 'tsconfig.json'];
const sourcePaths = () => [...new Set([...priorManifest.files.map(item => item.path).filter(runtimePath), ...relevant, ...entry.preservedInputs.map(item => item.path),
  ...git(['diff', '--name-only', '--diff-filter=ACMR', entry.checkpoint, '--', 'src']).split(/\r?\n/u).filter(runtimePath),
  ...git(['ls-files', '--others', '--exclude-standard', '--', 'src']).split(/\r?\n/u).filter(runtimePath)])].sort();
const unitFiles = ['src/components/globeStandInspection.test.ts', 'src/components/GlobeCameraRig.test.tsx', 'src/host/planetStandInspection.test.ts'];
const harness = [folder + '/check.mjs', folder + '/entry.json', ...(mode === 'browser'
  ? [folder + '/playwright.config.mjs', 'tests/pwa/stand-inspection.spec.mjs']
  : [...unitFiles, ...(mode === 'unit' ? [folder + '/unit.config.mjs'] : [])])].sort();
const snapshot = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const sourceFiles = await snapshot(sourcePaths()), checkInputs = await snapshot(harness);
const manifestDirectory = folder + '/source-manifests';
async function preserveManifest(files) {
  const bytes = json({ schemaVersion: 1, checkpoint: entry.checkpoint, files }), hash = sha(bytes), file = `${manifestDirectory}/${hash.slice(0, 16)}.json`;
  await fs.mkdir(manifestDirectory, { recursive: true });
  // Unit/static can run together: publish only fully written bytes, so the
  // other process never observes a partially written shared manifest.
  const temporary = `${manifestDirectory}/.${hash.slice(0, 16)}-${process.pid}-${mode}-${attempt}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: 'wx' });
  try { await fs.link(temporary, file); }
  catch (error) { if (error.code !== 'EEXIST') throw error;
    assert.equal(await fs.readFile(file, 'utf8'), bytes, 'Existing source manifest differs'); }
  finally { await fs.unlink(temporary); }
  return { path: file, sha256: hash, fileCount: files.length };
}
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
const sourceManifest = await preserveManifest(sourceFiles);
await fs.mkdir(out); await fs.mkdir(artifactRoot + '/temp', { recursive: true });
if (mode === 'browser') await assert.rejects(fs.stat(`${artifactRoot}/browser-${attempt}`), { code: 'ENOENT' });
const reportPath = path.resolve(out, mode === 'unit' ? 'vitest.json' : 'playwright.json');
const args = mode === 'static' ? ['node_modules/typescript/bin/tsc', '--noEmit'] : mode === 'unit'
  ? ['node_modules/vitest/vitest.mjs', 'run', '--config=' + folder + '/unit.config.mjs', '--reporter=json', '--outputFile=' + reportPath]
  : ['node_modules/@playwright/test/cli.js', 'test', '--config=' + folder + '/playwright.config.mjs'];
const startedAt = new Date().toISOString(), began = Date.now(), stdout = [], stderr = [];
let launchError = null;
const exitCode = await new Promise(resolve => {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
    TEMP: artifactRoot + '/temp', TMP: artifactRoot + '/temp', S13_BROWSER_OUTPUT: `${artifactRoot}/browser-${attempt}`,
    S13_BROWSER_PROFILE_ROOT: artifactRoot + '/profiles', S13_BROWSER_REPORT: reportPath } });
  child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
  child.once('error', error => { launchError = error.message; }); child.once('close', code => resolve(code));
});
let tests = null, reportError = launchError;
try {
  if (mode === 'unit') {
    const report = await read(reportPath), cases = report.testResults.flatMap(file => file.assertionResults);
    const normalized = file => path.resolve(file).replaceAll('\\', '/');
    assert.deepEqual(report.testResults.map(file => normalized(file.name)).sort(), unitFiles.map(normalized).sort());
    assert.ok(cases.length > 0); tests = { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests };
    assert.equal(cases.length, tests.passed + tests.failed + tests.skipped); assert.ok(cases.every(item => item.status === 'passed'));
  } else if (mode === 'browser') {
    const report = await read(reportPath); tests = { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky };
    assert.equal(tests.passed + tests.failed + tests.skipped + tests.flaky, 1); assert.deepEqual(report.errors, []);
  }
} catch (error) { reportError = [reportError, error.message].filter(Boolean).join('; '); }
let sourceInputsUnchanged = false, sourceManifestAfter = null;
try {
  const after = await snapshot(sourcePaths()); sourceInputsUnchanged = json(sourceFiles) === json(after) && json(checkInputs) === json(await snapshot(harness));
  if (json(sourceFiles) !== json(after)) sourceManifestAfter = await preserveManifest(after);
} catch (error) { reportError = [reportError, 'Source comparison: ' + error.message].filter(Boolean).join('; '); }
const logs = {};
for (const [name, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
  const file = `${out}/${name}.log`, bytes = Buffer.concat(chunks); await fs.writeFile(file, bytes, { flag: 'wx' });
  logs[name] = { path: file, bytes: bytes.length, sha256: sha(bytes) };
}
const execution = { command: [process.execPath, ...args], exitCode, durationMs: Date.now() - began, ...logs };
const pass = exitCode === 0 && sourceInputsUnchanged && !reportError && (!tests || tests.failed === 0 && tests.skipped === 0 && !tests.flaky);
const result = { schemaVersion: 1, mode, attempt, startedAt, sourceManifest, checkInputs, sourceInputsUnchanged,
  ...(sourceManifestAfter ? { sourceManifestAfter } : {}), tests, reportError, pass,
  execution: { exitCode, durationMs: execution.durationMs }, stageAccepted: false, artAccepted: false, releaseReady: false };
await fs.writeFile(out + '/execution.json', json(execution), { flag: 'wx' });
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({ mode, attempt, pass, tests, sourceManifest, reportError, execution: result.execution })); if (!pass) process.exitCode = 1;
