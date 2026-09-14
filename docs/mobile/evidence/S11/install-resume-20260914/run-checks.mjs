import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const [mode, attempt = 'a1'] = process.argv.slice(2);
assert.ok(['unit', 'browser'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = await fs.realpath('.');
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = 'docs/mobile/evidence/S11/install-resume-20260914/' + mode + '-' + attempt;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = ['src/pwa/serviceWorkerRuntime.js', 'src/pwa/serviceWorkerRuntime.test.mjs', 'src/pwa/pwaBootstrapBudgets.ts',
  'tests/pwa/install-resume.spec.mjs', 'package.json', 'package-lock.json', 'vitest.config.ts',
  '.tmp/s11-install-resume-20260914/playwright.config.mjs', '.tmp/s11-install-resume-20260914/run-checks.mjs'];
const snapshot = () => Promise.all(inputs.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const before = await snapshot();
const head = execFileSync('git', ['-c', 'safe.directory=' + root.replaceAll('\\', '/'), 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const reportPath = out + (mode === 'unit' ? '/vitest.json' : '/playwright.json');
const args = mode === 'unit'
  ? ['node_modules/vitest/vitest.mjs', 'run', 'src/pwa/serviceWorkerRuntime.test.mjs', '--reporter=json', '--outputFile=' + reportPath]
  : ['node_modules/@playwright/test/cli.js', 'test', '--config=.tmp/s11-install-resume-20260914/playwright.config.mjs'];
const logs = { stdout: [], stderr: [] }, startedAt = new Date().toISOString(), started = Date.now();
const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, S11_ATTEMPT: attempt, S11_BROWSER_REPORT: path.resolve(reportPath) } });
  for (const key of Object.keys(logs)) child[key].on('data', bytes => logs[key].push(bytes));
  child.on('error', reject); child.on('close', resolve);
});
const after = await snapshot(), unchanged = JSON.stringify(before) === JSON.stringify(after);
await fs.writeFile(out + '/execution.json', json({ command: [process.execPath, ...args], startedAt, durationMs: Date.now() - started, exitCode,
  logs: Object.fromEntries(Object.entries(logs).map(([key, chunks]) => { const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), bytes: bytes.length, sha256: sha(bytes) }]; })) }), { flag: 'wx' });
let report = null; try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch {}
let tests, proof;
if (mode === 'unit') tests = report && { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests, files: report.testResults.length,
  failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages }))) };
else if (report) {
  const cases = [];
  const collect = suites => { for (const suite of suites) { for (const spec of suite.specs ?? []) cases.push(...spec.tests); collect(suite.suites ?? []); } }; collect(report.suites ?? []);
  tests = { passed: report.stats.expected, failed: report.stats.unexpected, skipped: report.stats.skipped, flaky: report.stats.flaky,
    cases: cases.length, failures: cases.flatMap(test => test.results.flatMap(result => result.errors ?? [])) };
  for (const test of cases) for (const result of test.results) for (const attachment of result.attachments ?? []) {
    if (attachment.name !== 'install-resume-proof' || attachment.contentType !== 'application/json') continue;
    assert.ok(attachment.body); const bytes = Buffer.from(attachment.body, 'base64');
    await fs.writeFile(out + '/install-resume-proof.json', bytes, { flag: 'wx' });
    proof = { path: out + '/install-resume-proof.json', bytes: bytes.length, sha256: sha(bytes) };
  }
}
const pass = exitCode === 0 && unchanged && tests?.failed === 0 && tests.passed > 0 && tests.skipped === 0
  && (mode === 'unit' || tests.passed === 1 && tests.cases === 1 && tests.flaky === 0 && !!proof);
await fs.writeFile(out + '/result.json', json({ schemaVersion: 1, mode, startedAt, head, before, after, unchanged, exitCode, tests, proof, pass, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
console.log(json({ mode, attempt, pass, unchanged, tests, proof }));
if (!pass) process.exitCode = 1;
