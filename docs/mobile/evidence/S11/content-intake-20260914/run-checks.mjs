import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const [mode, attempt = 'a1', ...selectedTests] = process.argv.slice(2);
assert.ok(['unit', 'static', 'browser'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = 'docs/mobile/evidence/S11/content-intake-20260914/' + mode + '-' + attempt;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unitFiles = ['scripts/mobile/content-package-signature.test.mjs', 'scripts/mobile/content-export-input.test.mjs',
  'src/planet/verifyContentPackage.test.mjs', 'src/planet/contentPackageCache.test.mjs'];
assert.ok(selectedTests.every(file => unitFiles.includes(file)));
const inputs = ['src/planet/contentPackageProtocol.mjs', 'src/planet/contentPackageProtocol.d.mts',
  'src/planet/verifyContentPackage.ts', 'src/planet/contentPackageCache.ts', ...unitFiles,
  'scripts/mobile/content-package-signature.mjs', 'scripts/mobile/content-export-input.mjs',
  'tests/support/content-package-fixtures.mjs', 'tests/pwa/content-package-cache.spec.mjs',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts',
  '.tmp/s11-content-intake-20260914/playwright.config.mjs', '.tmp/s11-content-intake-20260914/run-checks.mjs'];
// Static checks cover the whole application; retain its exact source inventory.
if (mode === 'static') inputs.push(...execFileSync('git', ['-c', 'safe.directory=' + root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts/mobile/platform-boundaries.mjs'], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }).split('\0').filter(Boolean));
const snapshot = () => Promise.all([...new Set(inputs)].sort().map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const before = await snapshot(), startedAt = new Date().toISOString();
const head = execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const reportPath = path.resolve(out, mode === 'unit' ? 'vitest.json' : 'playwright.json');
const commands = mode === 'unit' ? [['unit', ['node_modules/vitest/vitest.mjs', 'run', ...(selectedTests.length ? selectedTests : unitFiles), '--maxWorkers=2', '--reporter=json', '--outputFile=' + reportPath]]]
  : mode === 'static' ? [['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']], ['platform-boundaries', ['scripts/mobile/platform-boundaries.mjs']]]
    : [['browser', ['node_modules/@playwright/test/cli.js', 'test', '--config=.tmp/s11-content-intake-20260914/playwright.config.mjs']]];
const executions = await Promise.all(commands.map(async ([name, args]) => {
  const streams = { stdout: [], stderr: [] }, began = Date.now();
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, S11_ATTEMPT: attempt, S11_BROWSER_REPORT: reportPath } });
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
let tests, proof;
if (mode === 'unit' && report) tests = { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests, files: report.testResults.length,
  failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages }))) };
if (mode === 'browser' && report) {
  const cases = [];
  const collect = suites => { for (const suite of suites) { for (const spec of suite.specs ?? []) cases.push(...spec.tests); collect(suite.suites ?? []); } }; collect(report.suites ?? []);
  tests = { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky,
    cases: cases.length, failures: cases.flatMap(test => test.results.flatMap(result => result.errors ?? [])) };
  for (const test of cases) for (const result of test.results) for (const attachment of result.attachments ?? []) {
    if (attachment.name !== 'content-package-cache-proof' || attachment.contentType !== 'application/json') continue;
    assert.ok(attachment.body); const bytes = Buffer.from(attachment.body, 'base64');
    const file = out + '/content-package-cache-proof.json'; await fs.writeFile(file, bytes, { flag: 'wx' });
    proof = { path: file, bytes: bytes.length, sha256: sha(bytes) };
  }
}
const pass = unchanged && executions.every(value => value.exitCode === 0) && (mode === 'static' || tests?.failed === 0 && tests.passed > 0 && tests.skipped === 0)
  && (mode !== 'browser' || tests.passed === 1 && tests.cases === 1 && tests.flaky === 0 && !!proof);
await fs.writeFile(out + '/result.json', json({ schemaVersion: 1, mode, startedAt, head, before, after, unchanged, executions, tests, proof, pass, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
console.log(json({ mode, attempt, pass, unchanged, executions, tests: tests && { ...tests, failures: tests.failures.map(f => ({ name: f.name, message: (f.messages?.[0] ?? f.message ?? '').slice(0, 1000) })) }, proof }));
if (!pass) process.exitCode = 1;
