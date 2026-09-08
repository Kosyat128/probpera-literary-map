import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

// PREPARED ONLY: root must explicitly run after the final source commit.
// One fresh source build, strict audit and one existing affected worker/offline browser case; old suites are not repeated.
const root = fs.realpathSync(process.cwd());
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === '--expected-source-commit' && /^[a-f0-9]{40}$/.test(args[1]), 'Explicit expected source commit required');
const expectedSourceCommit = args[1];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function safe(relative, existing = true) {
  const filename = path.resolve(root, relative), local = path.relative(root, filename);
  assert.ok(local && !local.startsWith('..') && !path.isAbsolute(local));
  if (existing) { assert.equal(fs.realpathSync(filename), filename); assert.equal(fs.lstatSync(filename).isSymbolicLink(), false); }
  return filename;
}
const bytes = relative => fs.readFileSync(safe(relative));
const read = relative => JSON.parse(bytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const git = options => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...options], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const trackedInputs = ['src', 'index.html', 'tsconfig.json', 'vite.config.ts', 'vite.pwa.config.ts', 'package.json', 'package-lock.json',
  'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/pwa-shell.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-portrait-selection.mjs', 'data/book-canon-source-registry.json'];
function snapshot() {
  return [...new Set([...git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...trackedInputs]).split('\0'), 'data/book-canon-source-registry.json'])]
    .filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)).sort().map(name => ({ path: name, sha256: sha(bytes(name)) }));
}
const supportInputs = ['scripts/mobile/verify-pwa-artifact.mjs', 'tests/pwa/controlled-pwa.spec.mjs', 'playwright.pwa-current.config.mjs', '.tmp/s10-capacity-pwa-20260908/playwright.capacity.config.mjs', 'tests/pwa/support/local-server.mjs', 'tests/pwa/support/cross-engine-server.mjs', '.tmp/s10-capacity-pwa-20260908/run-pwa-capacity.mjs'];
const supportSnapshot = () => supportInputs.map(name => ({ path: name, sha256: sha(bytes(name)) }));
const runId = 'pwa-capacity-20260908-a1';
// Child-only trust for this exact reviewed checkout; no global Git mutation.
Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root.replaceAll('\\', '/') });
const environment = { ...process.env, PWA_CROSS_ENGINE_RUN_ID: runId, PWA_CROSS_ENGINE_PORT: '4296',
  PLAYWRIGHT_BROWSERS_PATH: safe('.tmp/browser-engines'), PWA_CROSS_ENGINE_ALLOW_BUILD: '1' };
const { crossEngineSettings } = await import(pathToFileURL(safe('tests/pwa/support/cross-engine-server.mjs')));
const { startPwaQaServer } = await import(pathToFileURL(safe('tests/pwa/support/local-server.mjs')));
const settings = crossEngineSettings(environment), output = path.relative(root, settings.outputPath).replaceAll('\\', '/');
for (const file of ['dist-pwa', settings.authorityPath, settings.controlPath, output]) assert.equal(fs.existsSync(safe(file, false)), false, 'Refusing existing candidate/QA/run: ' + file);
const priorA221 = read('.tmp/s10-capacity-pwa-20260908/prior-a221-before-capacity.json');
assert.equal(priorA221.exactBeforeAfterVerified, true);
assert.equal(priorA221.buildId, 'a22183b0935b4108668d5d7d3009d3729cb32ea47ed388bd83a3135bd09d7363');
assert.equal(priorA221.artifactSha256, '6ca598be29ec0abf25b678c1ce65b41fc890d0ca23fe7402f0431c28def18fbd');
assert.equal(sha(bytes(priorA221.parkedPath + '/artifact.json')), priorA221.artifactSha256);
assert.equal(git(['rev-parse', 'HEAD']).trim(), expectedSourceCommit);
assert.equal(git(['status', '--porcelain=v1', '--untracked-files=normal', '--', ...trackedInputs, ...supportInputs.filter(name => !name.startsWith('.tmp/'))]).trim(), '', 'Source must be committed and clean');
const before = snapshot(), supportBefore = supportSnapshot();
fs.mkdirSync(safe(output, false));
const save = (name, value) => fs.writeFileSync(safe(output + '/' + name, false), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('source-before.json', before); save('support-before.json', supportBefore);
function command(name, commandArgs) {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(safe(output + '/' + name + '.log', false), { flags: 'wx' });
    const stdout = [], stderr = [];
    const started = Date.now(), child = spawn(process.execPath, commandArgs, { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { stdout.push(data); log.write(data); }); child.stderr.on('data', data => { stderr.push(data); log.write(data); });
    child.once('error', error => { log.end(); reject(error); });
    child.once('close', code => { log.end(() => {
      fs.writeFileSync(safe(output + '/' + name + '.stdout.log', false), Buffer.concat(stdout), { flag: 'wx' });
      fs.writeFileSync(safe(output + '/' + name + '.stderr.log', false), Buffer.concat(stderr), { flag: 'wx' });
      save(name + '-execution.json', { command: [process.execPath, ...commandArgs], exitCode: code, durationMs: Date.now() - started });
      resolve(code);
    }); });
  });
}
const title = 'expanded portrait base installs and verifies real offline bytes with saved graphics and bilingual scene';
const browserArgs = ['node_modules/@playwright/test/cli.js', 'test', '--config=.tmp/s10-capacity-pwa-20260908/playwright.capacity.config.mjs', '--project=pwa-desktop'];
let server, artifact, strictPassed = false, failure = null, browserExit = null, statistics = null, browserExecutions = 0;
try {
  const discoveryExit = await command('discovery', [...browserArgs, '--list', '--reporter=json']);
  assert.equal(discoveryExit, 0);
  const discovery = read(output + '/discovery.stdout.log');
  const selected = [];
  const collect = suites => { for (const suite of suites) { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) selected.push({ title: spec.title, project: test.projectName }); collect(suite.suites ?? []); } };
  collect(discovery.suites ?? []);
  assert.deepEqual(selected, [{ title, project: 'pwa-desktop' }]);
  save('discovery.json', { selected, selectedCount: selected.length, browserExecutions: 0, beforeSignerAndBuild: true });
  server = await startPwaQaServer({ port: settings.port, authorityPath: settings.authorityPath, controlPath: settings.controlPath, buildQa: true });
  artifact = read('dist-pwa/artifact.json');
  assert.equal(artifact.sourceCommit, expectedSourceCommit); assert.equal(artifact.localQaAuthority, true); assert.equal(artifact.releaseReady, false);
  assert.deepEqual(artifact.sourceInputs.files, before);
  save('session.json', { schemaVersion: 1, runId, localQaOnly: true, origin: settings.origin,
    artifact: { buildId: artifact.buildId, sourceCommit: artifact.sourceCommit, sourceInputsSha256: artifact.sourceInputs.sha256,
      authoritySha256: artifact.authoritySha256, localQaAuthority: true, releaseReady: false },
    planned: { sourceBuilds: 1, strictArtifactAudits: 1, browserExecutions: 1 },
    limits: ['Ephemeral signer exists only in this local process. No provider/payment or installed OS evidence.',
      'One new Vite/worker build for compiled search fields and cancellable batched preparation in the existing globe and shared search. Previous a22183b0 and all historical evidence remain archived. Only one existing expanded-portrait install/readiness/offline case runs to verify the changed bundle under the actual worker; no full appearance/repair suite is rerun. Mounted React preparation lifecycle, synthetic capacity measurements and native-source search interaction are separate evidence.'] });
  const auditExit = await command('strict-artifact-audit', ['scripts/mobile/verify-pwa-artifact.mjs', '--allow-qa']);
  assert.equal(auditExit, 0, 'Strict audit process failed');
  const audit = read(output + '/strict-artifact-audit.log');
  assert.equal(audit.pass, true); assert.equal(audit.identity.buildId, artifact.buildId); assert.equal(audit.identity.sourceCommit, expectedSourceCommit);
  save('strict-artifact-audit.json', audit); strictPassed = true;
  browserExecutions = 1;
  browserExit = await command('browser-run', browserArgs);
  statistics = read(output + '/results.json').stats;
  assert.equal(browserExit, 0, 'Affected browser process failed');
  assert.deepEqual([statistics.expected, statistics.unexpected, statistics.skipped, statistics.flaky], [1, 0, 0, 0]);

} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) { await server.close(); save('server-closed.json', { gracefulClose: true, closedAt: new Date().toISOString(), localQaOnly: true }); }
  const after = snapshot(), supportAfter = supportSnapshot(), finalHead = git(['rev-parse', 'HEAD']).trim();
  save('source-after.json', after); save('support-after.json', supportAfter);
  const unchanged = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(supportBefore) === JSON.stringify(supportAfter) && finalHead === expectedSourceCommit;
  save('source-comparison.json', { sourceFiles: before.length, supportFiles: supportBefore.length, unchangedDuringRun: unchanged, expectedSourceCommit, finalHead });
  const pass = !failure && strictPassed && unchanged && browserExit === 0 && statistics?.expected === 1 && statistics.unexpected === 0 && statistics.skipped === 0 && statistics.flaky === 0;
  save('run-result.json', { schemaVersion: 1, runId, sourceCommit: expectedSourceCommit, buildId: artifact?.buildId ?? null,
    strictArtifactAuditPassed: strictPassed, browserTestsRun: browserExecutions > 0, browserExecutions, statistics, browserExitCode: browserExit, failure, sourceUnchanged: unchanged,
    pass, stageAccepted: false, releaseReady: false, installedRuntimeVerified: false, productionActionsPerformed: false });
  console.log(JSON.stringify({ runId, buildId: artifact?.buildId ?? null, strictPassed, browserExecutions, statistics, pass }));
  if (!pass) process.exitCode = 1;
}
