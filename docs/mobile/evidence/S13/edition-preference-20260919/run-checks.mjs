import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const [mode, attempt = 'a1'] = process.argv.slice(2);
assert.ok(['unit', 'static', 'browser'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const evidence = 'docs/mobile/evidence/S13/edition-preference-20260919';
const out = evidence + '/' + mode + '-' + attempt;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-ep';
await fs.mkdir(artifactRoot + '/temp', { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
 'src/components/LiteraryGlobe.tsx', 'src/components/useGlobeStyleState.ts', 'src/components/useGlobeStyleState.test.ts', 'src/components/globeAtlas.ts', 'src/components/globeEditions.ts', 'src/host/planetEditionPreference.ts', 'src/host/planetEditionPreference.test.ts', 'src/host/PlanetEditionPreferenceStatus.tsx', 'src/host/PlanetEditionPreferenceStatus.css', 'src/host/HostPlatformServices.ts', 'src/host/HostPlatformServices.test.ts', 'src/platform/adapters/web/WebPlatformAdapter.ts', 'src/platform/adapters/web/WebPlatformAdapter.test.ts', 'src/platform/PlatformServices.tsx', 'src/platform/ports.ts', 'src/platform/distribution.ts', 'src/i18n/InterfaceLanguage.tsx',
 'tests/pwa/globe-edition-preference.spec.mjs', 'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts',
 evidence + '/run-checks.mjs', evidence + '/playwright.config.mjs'], {encoding:'utf8', windowsHide:true}).split('\0').filter(Boolean);
const snapshot = () => Promise.all([...new Set(inputs)].sort().map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const before = await snapshot(), startedAt = new Date().toISOString();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const reportPath = path.resolve(out, mode === 'unit' ? 'vitest.json' : 'playwright.json');
const unitFiles = ['src/host/planetEditionPreference.test.ts', 'src/components/useGlobeStyleState.test.ts', 'src/host/HostPlatformServices.test.ts', 'src/platform/adapters/web/WebPlatformAdapter.test.ts'];
const commands = mode === 'unit' ? [['unit', ['node_modules/vitest/vitest.mjs', 'run', ...unitFiles, '--maxWorkers=2', '--reporter=json', '--outputFile=' + reportPath]]]
 : mode === 'static' ? [['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']], ['platform-boundaries', ['scripts/mobile/platform-boundaries.mjs']]]
 : [[mode, ['node_modules/@playwright/test/cli.js', 'test', '--config=' + evidence + '/playwright.config.mjs']]];
const executions = [];
for (const [name, args] of commands) {
 const streams = { stdout: [], stderr: [] }, began = Date.now();
 const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
   TEMP: artifactRoot + '/temp', TMP: artifactRoot + '/temp', S13_ATTEMPT: attempt, S13_MODE: mode,
   S13_BROWSER_REPORT: reportPath, S13_BROWSER_OUTPUT: artifactRoot + '/' + mode + '-' + attempt,
   S13_BROWSER_PROFILE_ROOT: artifactRoot + '/profiles' } });
  for (const key of Object.keys(streams)) child[key].on('data', bytes => streams[key].push(bytes));
  child.on('error', reject); child.on('close', resolve);
 });
 const record = { command: [process.execPath, ...args], startedAt, durationMs: Date.now() - began, exitCode,
  logs: Object.fromEntries(Object.entries(streams).map(([key, chunks]) => { const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), sha256: sha(bytes) }]; })) };
 await fs.writeFile(out + '/' + name + '.json', json(record), { flag: 'wx' });
 executions.push({ name, exitCode, durationMs: record.durationMs });
}
const after = await snapshot(), unchanged = json(before) === json(after);
let report = null; if (mode !== 'static') try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch {}
const tests = !report ? null : mode === 'unit' ? { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests,
 failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages }))) }
 : { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky, errors: report.errors };
const result = { schemaVersion: 1, mode, startedAt, endedAt: new Date().toISOString(), sourceBase: head, sourceInputs: before,
 sourceInputsUnchanged: unchanged, executions, tests, pass: unchanged && executions.every(item => item.exitCode === 0),
 releaseReady: false, deviceTested: false, productionActivation: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({ mode, pass: result.pass, tests, executions, result: out + '/result.json' }));
if (!result.pass) process.exitCode = 1;
