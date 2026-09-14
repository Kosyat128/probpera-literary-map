import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const [mode, attempt = 'a1'] = process.argv.slice(2);
assert.ok(['unit', 'static', 'browser', 'globe'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = 'docs/mobile/evidence/S11/download-controls-20260914/' + mode + '-' + attempt;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unitFiles = ['src/planet/ContentDownloads.test.mjs', 'src/host/nativeContentStorage.test.mjs',
 'src/planet/contentPackageTransport.test.mjs', 'src/planet/verifyContentPackage.test.mjs', 'src/planet/contentPackageCache.test.mjs',
 'src/platform/adapters/web/WebPlatformAdapter.test.ts', 'src/platform/adapters/android/AndroidPlatformAdapter.test.ts', 'src/platform/adapters/ios/IosPlatformAdapter.test.ts'];
const inputs = execFileSync('git', ['-c', 'safe.directory=' + root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
 'src', 'tests/host/native-planet.spec.mjs', 'tests/pwa', 'tests/support/content-package-fixtures.mjs', 'scripts/mobile/platform-boundaries.mjs',
 'scripts/mobile/content-package-signature.mjs', 'apps/mobile/android/app/src/main/java', 'apps/mobile/ios/App/App/PlanetContentStorePlugin.swift',
 'apps/mobile/ios/App/App/Base.lproj/Main.storyboard', 'apps/mobile/ios/App/App.xcodeproj/project.pbxproj', 'package.json', 'package-lock.json',
 'tsconfig.json', 'vitest.config.ts', 'playwright.native-planet.config.mjs'], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }).split('\0').filter(Boolean);
inputs.push('.tmp/s11-download-controls-20260914/playwright.config.mjs', '.tmp/s11-download-controls-20260914/run-checks.mjs', '.tmp/s11-download-controls-20260914/globe.config.mjs');
const snapshot = () => Promise.all([...new Set(inputs)].sort().map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const before = await snapshot(), startedAt = new Date().toISOString();
const head = execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const reportPath = path.resolve(out, mode === 'unit' ? 'vitest.json' : 'playwright.json');
const commands = mode === 'unit' ? [['unit', ['node_modules/vitest/vitest.mjs', 'run', ...unitFiles, '--maxWorkers=2', '--reporter=json', '--outputFile=' + reportPath]]]
 : mode === 'static' ? [['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']], ['platform-boundaries', ['scripts/mobile/platform-boundaries.mjs']]]
 : [[mode, ['node_modules/@playwright/test/cli.js', 'test', '--config=.tmp/s11-download-controls-20260914/' + (mode === 'globe' ? 'globe' : 'playwright') + '.config.mjs']]];
const executions = await Promise.all(commands.map(async ([name, args]) => {
 const streams = { stdout: [], stderr: [] }, began = Date.now();
 const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
    S11_ATTEMPT: attempt, S11_BROWSER_REPORT: reportPath,
    S11_BROWSER_PROFILE_ROOT: 'D:/CodexData/.codex/visualizations/2026/09/04/01a06dd0-30ba-7fe1-9637-858d87ac1ff5/s11-content-qa' } });
  for (const key of Object.keys(streams)) child[key].on('data', bytes => streams[key].push(bytes));
  child.on('error', reject); child.on('close', resolve);
 });
 const record = { command: [process.execPath, ...args], startedAt, durationMs: Date.now() - began, exitCode,
   logs: Object.fromEntries(Object.entries(streams).map(([key, chunks]) => { const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), bytes: bytes.length, sha256: sha(bytes) }]; })) };
 await fs.writeFile(out + '/' + name + '.json', json(record), { flag: 'wx' });
 return { name, exitCode, durationMs: record.durationMs, evidence: out + '/' + name + '.json' };
}));
const after = await snapshot(), unchanged = json(before) === json(after);
let report = null; if (mode !== 'static') try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch {}
let tests;
if (mode === 'unit' && report) tests = { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests, files: report.testResults.length,
 failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages }))) };
if (['browser', 'globe'].includes(mode) && report) tests = { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky, errors: report.errors };
const result = { schemaVersion: 1, mode, startedAt, endedAt: new Date().toISOString(), sourceBase: head, sourceInputs: before,
 sourceInputsUnchanged: unchanged, executions, tests, pass: unchanged && executions.every(item => item.exitCode === 0),
 releaseReady: false, deviceTested: false, productionActivation: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({ mode, pass: result.pass, tests, executions, result: out + '/result.json' }));
if (!result.pass) process.exitCode = 1;
