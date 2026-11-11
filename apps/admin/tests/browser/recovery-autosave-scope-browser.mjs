import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(own, '../../../..');
const work = path.resolve(repo, '../work');
const stageIndex = process.argv.indexOf('--stage');
const stage = stageIndex < 0 ? null : process.argv[stageIndex + 1];
assert.ok(stage === 'BEFORE' || stage === 'AFTER', 'Pass an explicit --stage BEFORE or AFTER');
const require = createRequire(path.join(repo, 'package.json'));
const out = fs.mkdtempSync(path.join(work, 'm20-autosave-scope-' + stage.toLowerCase() + '-'));
const envAllow = /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i;
for (const name of Object.keys(process.env)) if (!envAllow.test(name)) delete process.env[name];
const temp = path.join(out, 'temp'); fs.mkdirSync(temp);
Object.assign(process.env, { CI: '1', NEXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1', TEMP: temp, TMP: temp });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const capture = file => {
  const full = path.join(repo, file), bytes = fs.readFileSync(full), dest = path.join(out, 'sources', file);
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
  sources.set(file, { file, bytes: bytes.length, sha256: hash(bytes) }); return bytes.toString();
};
const sources = new Map();
const virtual = {
  'next/navigation': 'export {unstable_rethrow} from "next/dist/client/components/unstable-rethrow.browser";',
  '@/app/(dashboard)/editor-autosave/actions': 'export function loadLatestEditorAutosaveAction(input){return window.__m20Scope.action("load",input)}export function saveEditorAutosaveAction(input){return window.__m20Scope.action("save",input)}export function deleteExactEditorAutosaveAction(input){return window.__m20Scope.action("delete",input)}'
};
const { build } = require('esbuild'), { chromium } = require('playwright');
const entry = path.join(own, 'fixtures/recovery-autosave-scope-entry.jsx');
fs.copyFileSync(entry, path.join(out, 'entry.jsx'));
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, 'producer.mjs'));
const built = await build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'chrome120', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'actual-recovery-with-controlled-server-boundary', setup(builder) {
    builder.onResolve({ filter: /.*/ }, request => {
      if (Object.hasOwn(virtual, request.path)) return { path: request.path, namespace: 'boundary' };
      if (/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path)) return { path: require.resolve('next/dist/compiled/' + request.path) };
      if (/^node:|@supabase|(?:^|\/)server-only$|\/lib\/auth(?:\.|\/)|\/lib\/supabase\//u.test(request.path)) throw Error('Uncontrolled server dependency: ' + request.path);
      if (request.path.startsWith('@/')) {
        const base = path.join(repo, 'apps/admin', request.path.slice(2)), file = [base, base + '.ts', base + '.tsx'].find(fs.existsSync);
        assert.ok(file, request.path); return { path: file };
      }
    });
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, request => ({ contents: virtual[request.path], loader: 'js', resolveDir: repo }));
    builder.onLoad({ filter: /\.[jt]sx?$/ }, request => {
      if (!request.path.startsWith(path.join(repo, 'apps/admin') + path.sep)) return;
      if (request.path.includes(path.sep + 'node_modules' + path.sep)) return;
      const file = path.relative(repo, request.path).replaceAll('\\', '/');
      return { contents: capture(file), loader: request.path.endsWith('.tsx') ? 'tsx' : request.path.endsWith('.ts') ? 'ts' : request.path.endsWith('.jsx') ? 'jsx' : 'js' };
    });
  } }] });
const bundle = built.outputFiles[0].text; fs.writeFileSync(path.join(out, 'bundle.js'), bundle);
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(bundle); }
  else if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>'); }
  else { res.writeHead(404); res.end(); }
});
const scenarios = ['entity-same-snapshot', 'locale-same-snapshot', 'version-same-snapshot', 'same-locator-control', 'latest-input-after-pending-control', 'old-save-after-locator-control', 'matching-server-recovery-control', 'storage-security-control', 'storage-quota-control', 'crypto-unavailable'];
const observations = [], externalRequests = [];
let browser;
console.log(JSON.stringify({ output: out, state: 'START', scenarios: scenarios.length }));
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const scenario of scenarios) {
    const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push({ name: error.name, message: error.message }));
    try {
      await context.route('**/*', route => { if (route.request().url().startsWith(origin + '/')) return route.continue(); externalRequests.push({ scenario, url: route.request().url() }); return route.abort('blockedbyclient'); });
      await page.clock.install({ time: new Date('2026-10-30T12:00:00Z') });
      await context.addInitScript(scenario => {
        window.IS_REACT_ACT_ENVIRONMENT = true;
        const h = window.__m20Scope = { scenario, calls: [], action(kind, input) {
          const row = { kind, input, state: 'pending' }; h.calls.push(row);
          return new Promise((resolve, reject) => { row.resolve = resolve; row.reject = reject; });
        }, settle(index, value, reject) { const row = h.calls[index]; row.state = reject ? 'rejected' : 'resolved'; if (reject) row.reject(new Error('CONTROLLED_SERVER_FAILURE')); else row.resolve(value); } };
        window.fetch = async () => { throw Error('External network forbidden'); };
        if (scenario === 'crypto-unavailable') Object.defineProperty(window.crypto, 'randomUUID', { value: undefined, configurable: true });
        if (scenario.startsWith('storage-')) {
          if (scenario === 'storage-security-control') Storage.prototype.getItem = function() { throw new DOMException('Controlled storage refusal', 'SecurityError'); };
          Storage.prototype.setItem = function() { throw new DOMException('Controlled storage refusal', scenario === 'storage-quota-control' ? 'QuotaExceededError' : 'SecurityError'); };
        }
      }, scenario);
      await page.goto(origin + '/');
      const flush = (index, value, reject = false) => page.evaluate(({ index, value, reject }) => window.__m20Scope.flush(index, value, reject), { index, value, reject });
      const tick = async () => { await page.clock.fastForward(15000); await page.evaluate(() => window.__m20Scope.flushEffects()); };
      const current = () => page.evaluate(() => ({ calls: window.__m20Scope.calls.map(({ resolve, reject, ...row }) => row), input: document.querySelector('textarea')?.value ?? null, status: document.querySelector('.editor-autosave-status')?.className ?? null, text: document.body.innerText, locator: document.querySelector('[data-locator]')?.textContent ?? null }));
      const receipt = { id: '11111111-1111-4111-8111-111111111111', state: 'saved', sequence: 1, snapshotHash: 'f'.repeat(64), baseUpdatedAt: '2026-10-30T10:00:00.123456Z', updatedAt: '2026-10-30T10:01:00Z', expiresAt: '2026-11-29T10:01:00Z' };
      if (scenario !== 'crypto-unavailable') {
        await page.waitForFunction(() => window.__m20Scope.calls.length === 1);
        await flush(0, { ok: true, recovery: scenario === 'matching-server-recovery-control' ? { ...receipt, clientSessionId: '22222222-2222-4222-8222-222222222222', snapshot: { title: 'Authored snapshot S' } } : null });
        await tick();
        if (scenario !== 'matching-server-recovery-control') {
          assert.equal((await current()).calls.filter(row => row.kind === 'save').length, 1, 'Initial save prerequisite');
          if (scenario === 'latest-input-after-pending-control') await page.getByRole('textbox', { name: 'Current input' }).fill('Authored snapshot B while A is pending');
          if (scenario === 'old-save-after-locator-control') {
            await page.getByRole('button', { name: 'Switch locator' }).click(); await page.evaluate(() => window.__m20Scope.flushEffects());
            const pending = (await current()).calls; assert.equal(pending[2].kind, 'load'); await flush(2, { ok: true, recovery: null });
          }
          await flush(1, { ok: true, receipt });
          if (['entity-same-snapshot', 'locale-same-snapshot', 'version-same-snapshot', 'same-locator-control'].includes(scenario)) {
            await page.getByRole('button', { name: 'Switch locator' }).click(); await page.evaluate(() => window.__m20Scope.flushEffects());
            if (scenario !== 'same-locator-control') { const pending = (await current()).calls; assert.equal(pending[2].kind, 'load'); await flush(2, { ok: true, recovery: null }); }
          }
          await tick();
        }
      }
      const state = await current(), saves = state.calls.filter(row => row.kind === 'save'), checks = [];
      const check = (name, pass, category = 'control') => checks.push({ name, pass: Boolean(pass), category });
      if (scenario.endsWith('same-snapshot')) {
        check('new locator receives its own same-content autosave', saves.length === 2, 'target');
        check('new save uses new scoped identity', saves.length === 2 && (scenario.startsWith('entity-') ? saves[1].input.entityId !== saves[0].input.entityId : scenario.startsWith('locale-') ? saves[1].input.localeScope !== saves[0].input.localeScope : saves[1].input.baseUpdatedAt !== saves[0].input.baseUpdatedAt), 'target');
      } else if (scenario === 'crypto-unavailable') {
        check('input remains mounted when UUID capability unavailable', state.input === 'Authored snapshot S', 'target');
        check('unavailable autosave session is an explicit error', state.status?.includes('is-error'), 'target');
      } else if (scenario === 'latest-input-after-pending-control') {
        check('last input gets a trailing save', saves.length === 2 && JSON.parse(saves[1].input.snapshotText).title === 'Authored snapshot B while A is pending');
      } else if (scenario === 'old-save-after-locator-control') {
        check('old save acknowledgement cannot suppress new scope', saves.length === 2 && saves[1].input.entityId !== saves[0].input.entityId);
      } else check('same scope or matching recovery suppresses redundant saves', saves.length === (scenario === 'matching-server-recovery-control' ? 0 : 1));
      check('authored input preserved', state.input === (scenario === 'latest-input-after-pending-control' ? 'Authored snapshot B while A is pending' : 'Authored snapshot S'), 'preservation');
      check('no browser crash', errors.length === 0, 'preservation');
      observations.push({ scenario, criterion: scenario === 'crypto-unavailable' ? 'M20-T06' : 'M20-T08', checks, state, errors });
    } finally { await context.close(); }
  }
  for (const row of sources.values()) assert.equal(hash(fs.readFileSync(path.join(repo, row.file))), row.sha256, 'Executed source drift');
  assert.deepEqual(externalRequests, []);
  const all = observations.flatMap(row => row.checks), report = { classification: 'ACTUAL_REACT_CHROME_RECOVERY_AUTOSAVE_TIMERS_CONTROLLED_ACTIONS_NOT_FULL_EDITOR_DB_OR_AUTH', stage, checkedAt: new Date().toISOString(),
    timerPolicy: 'Actual unchanged 15000ms component timer advanced by Playwright browser clock; no hook clone or changed timeout/interval constant', sources: [...sources.values()], observations, externalRequests,
    total: all.length, passed: all.filter(row => row.pass).length, failed: all.filter(row => !row.pass).length,
    targetFailures: all.filter(row => !row.pass && row.category === 'target').length, preservationFailures: all.filter(row => !row.pass && row.category === 'preservation').length,
    controlFailures: all.filter(row => !row.pass && row.category === 'control').length,
    packages: ['next', 'playwright', 'esbuild'].map(name => ({ name, version: require(name + '/package.json').version })) };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output: out, scenarios: observations.length, total: report.total, passed: report.passed, failed: report.failed, targetFailures: report.targetFailures, controlFailures: report.controlFailures, preservationFailures: report.preservationFailures }));
  process.exitCode = report.failed ? 1 : 0;
} finally {
  if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(out, 'cleanup.json'), JSON.stringify({ browserCloseAwaited: Boolean(browser), ownLoopbackClosed: !server.listening, databaseConnections: 0, providerCalls: 0 }) + '\n');
}
