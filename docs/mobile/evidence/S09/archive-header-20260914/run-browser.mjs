import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = await fs.realpath(process.cwd());
const attempt = process.argv[2] || 'a1';
assert.match(attempt, /^a[1-9][0-9]*$/);
const runId = `s09-archive-header-20260914-${attempt}`;
const out = `docs/mobile/evidence/S09/archive-header-20260914/browser-${attempt}`;
const browserOut = `.tmp/native-planet-browser-results/${runId}`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const env = { ...process.env, NATIVE_PLANET_RUN_ID: runId, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root.replaceAll('\\', '/') };
const git = args => execFileSync('git', args, { cwd: root, env, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'data/book-canon-source-registry.json', 'scripts/mobile', 'tests/host/native-planet.spec.mjs', 'playwright.native-planet.config.mjs', 'package.json', 'package-lock.json']).split('\0').filter(Boolean);
const snapshot = async () => Promise.all([...new Set(files)].sort().map(async name => ({ path: name, sha256: sha(await fs.readFile(name)) })));
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
await assert.rejects(fs.stat(browserOut), { code: 'ENOENT' });
await fs.mkdir(out, { recursive: true });
const before = await snapshot(), head = git(['rev-parse', 'HEAD']).trim();
const titles = {
  writer: 'native book author navigation closes the reader and reveals the canonical writer across RU and EN on the retained globe',
  collection: 'native collections disclose session-only favorites and smart shelves when IndexedDB is unavailable',
};
const title = titles[process.argv[3] || 'writer']; assert.ok(title);
const args = ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.native-planet.config.mjs', '--grep', title];
const startedAt = new Date().toISOString(), start = Date.now(), streams = { stdout: [], stderr: [] };
const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const key of Object.keys(streams)) child[key].on('data', bytes => streams[key].push(bytes));
  child.on('error', reject); child.on('close', resolve);
});
const after = await snapshot(), unchanged = JSON.stringify(before) === JSON.stringify(after);
const logs = Object.fromEntries(Object.entries(streams).map(([key, chunks]) => { const bytes = Buffer.concat(chunks); return [key, { text: bytes.toString('utf8'), bytes: bytes.length, sha256: sha(bytes) }]; }));
await fs.writeFile(out + '/execution.json', json({ command: [process.execPath, ...args], startedAt, durationMs: Date.now() - start, exitCode, logs }), { flag: 'wx' });
await fs.writeFile(out + '/source-inputs.json', json({ head, before, after, unchanged }), { flag: 'wx' });
let report = null;
try { report = JSON.parse(await fs.readFile(browserOut + '/results.json', 'utf8')); } catch {}
const cases = [];
function collect(suites) { for (const suite of suites) { for (const spec of suite.specs || []) for (const test of spec.tests || []) cases.push({ title: spec.title, test }); collect(suite.suites || []); } }
collect(report?.suites || []);
const preserved = [];
async function preserve(name, bytes) {
  assert.match(name, /^[a-z0-9.-]+$/i);
  await fs.writeFile(out + '/' + name, bytes, { flag: 'wx' });
  preserved.push({ path: out + '/' + name, bytes: bytes.length, sha256: sha(bytes) });
}
if (report) await preserve('playwright.json', Buffer.from(json(report)));
for (const item of cases) {
  for (const result of item.test.results || []) for (const attachment of result.attachments || []) {
    if (!attachment.name.startsWith('native-book-author-return-') && !attachment.name.startsWith('native-collection-session-') && !attachment.name.startsWith('native-final-')) continue;
    if (attachment.contentType === 'application/json' && attachment.body) await preserve(attachment.name + '.json', Buffer.from(attachment.body, 'base64'));
    else if (attachment.contentType === 'image/png' && attachment.path) {
      const absolute = path.resolve(root, attachment.path), relative = path.relative(path.resolve(root, browserOut), absolute);
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
      assert.equal(await fs.realpath(absolute), absolute);
      await preserve(attachment.name + '.png', await fs.readFile(absolute));
    }
  }
}
const pass = exitCode === 0 && unchanged && cases.length === 1 && cases[0].title === title && report?.stats.expected === 1 && report.stats.unexpected === 0 && report.stats.flaky === 0 && report.stats.skipped === 0;
const result = { schemaVersion: 1, runId, title, head, status: pass ? 'SOURCE_BROWSER_PASSED' : 'SOURCE_BROWSER_FAILED', pass,
  sourceInputsSha256: sha(json(before)), sourceInputsUnchanged: unchanged, statistics: report?.stats, exitCode,
  cases: cases.map(item => ({ title: item.title, results: item.test.results.map(value => ({ status: value.status, duration: value.duration, errors: value.errors })) })), preserved,
  fixtureUsesCanonicalAppAndScene: true, actualInstalledRuntime: false, nativePluginsSimulated: true, stageAccepted: false, releaseReady: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({ ...result, preserved: preserved.length }));
if (!pass) process.exitCode = 1;
