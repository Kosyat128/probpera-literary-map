import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const mode = process.argv[2], attempt = process.argv[3] || 'a1';
assert.ok(['unit', 'unit-repair', 'unit-controls', 'static', 'typecheck'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/);
const out = `docs/mobile/evidence/S10/history-20260908/${mode}-${attempt}`;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = (await fs.realpath('.')).replaceAll('\\', '/');
const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root };
const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts/mobile', 'data/book-canon-source-registry.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts'], { env, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean);
const snapshot = () => Promise.all([...new Set(names)].sort().map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const before = await snapshot();
const unitFiles = ['src/host/HostRecentHistory.test.ts', 'src/host/HostPlatformServices.test.ts', 'src/components/RecentHistoryPanel.test.tsx', 'src/platform/adapters/web/WebRecentHistory.test.ts', 'src/hooks/useBookCollections.test.ts', 'src/books/bookCollectionStorage.test.ts'];
const unitMode = mode.startsWith('unit');
const checks = unitMode
  ? [['unit', ['node_modules/vitest/vitest.mjs', 'run', ...(mode === 'unit-repair' ? [unitFiles[0], unitFiles[4]] : mode === 'unit-controls' ? ['src/components/BookShelfControls.test.tsx'] : unitFiles), '--reporter=json', `--outputFile=${out}/vitest.json`]]]
  : [['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']], ...(mode === 'typecheck' ? [] : [['platform-boundaries', ['scripts/mobile/platform-boundaries.mjs']]])];
const executions = await Promise.all(checks.map(([name, args]) => new Promise((resolve, reject) => {
  const streams = { stdout: [], stderr: [] }, startedAt = new Date().toISOString(), start = Date.now();
  const child = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const key of Object.keys(streams)) child[key].on('data', bytes => streams[key].push(bytes));
  child.on('error', reject); child.on('close', async exitCode => {
    try {
      const logs = Object.fromEntries(Object.entries(streams).map(([key, chunks]) => { const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), bytes: bytes.length, sha256: sha(bytes) }]; }));
      const record = { name, command: [process.execPath, ...args], startedAt, durationMs: Date.now() - start, exitCode, logs };
      await fs.writeFile(`${out}/${name}.json`, json(record), { flag: 'wx' });
      resolve({ ...record, logs: undefined, evidence: `${out}/${name}.json` });
    } catch (error) { reject(error); }
  });
})));
const after = await snapshot(), unchanged = JSON.stringify(before) === JSON.stringify(after);
let report = null;
if (unitMode) try { report = JSON.parse(await fs.readFile(`${out}/vitest.json`, 'utf8')); } catch {}
const tests = report ? { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests, files: report.testResults.length,
  failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ file: file.name, name: test.fullName, messages: test.failureMessages }))) } : null;
const pass = unchanged && executions.every(value => value.exitCode === 0) && (!unitMode || Boolean(tests) && tests.failed === 0 && tests.passed > 0);
await fs.writeFile(`${out}/result.json`, json({ schemaVersion: 1, mode, before, after, unchanged, executions, tests, pass, stageAccepted: false, releaseReady: false }), { flag: 'wx' });
console.log(json({ mode, unchanged, executions, tests, pass }));
if (!pass) process.exitCode = 1;
