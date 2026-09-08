import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

// PREPARED ONLY: root must explicitly run after the final source commit.
// One fresh source build, strict audit and one device scenario in two viewports.
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
  'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/pwa-shell.mjs'];
function snapshot() {
  return [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...trackedInputs]).split('\0'))]
    .filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)).sort().map(name => ({ path: name, sha256: sha(bytes(name)) }));
}
const supportInputs = ['tests/pwa/controlled-pwa.spec.mjs', 'tests/pwa/support/local-server.mjs', 'tests/pwa/support/cross-engine-server.mjs',
  'playwright.pwa-current.config.mjs', '.tmp/s03-offline-repair-20260908/playwright.repair.config.mjs'];
const supportSnapshot = () => supportInputs.map(name => ({ path: name, sha256: sha(bytes(name)) }));
const runId = 'pwa-offline-repair-20260908-a2';
// Child-only trust for this exact reviewed checkout; no global Git mutation.
Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root.replaceAll('\\', '/') });
const environment = { ...process.env, PWA_CROSS_ENGINE_RUN_ID: runId, PWA_CROSS_ENGINE_PORT: '4296',
  PLAYWRIGHT_BROWSERS_PATH: safe('.tmp/browser-engines'), PWA_CROSS_ENGINE_ALLOW_BUILD: '1' };
const { crossEngineSettings } = await import(pathToFileURL(safe('tests/pwa/support/cross-engine-server.mjs')));
const { startPwaQaServer } = await import(pathToFileURL(safe('tests/pwa/support/local-server.mjs')));
const settings = crossEngineSettings(environment), output = path.relative(root, settings.outputPath).replaceAll('\\', '/');
for (const file of ['dist-pwa', settings.authorityPath, settings.controlPath, output]) assert.equal(fs.existsSync(safe(file, false)), false, 'Refusing existing candidate/QA/run: ' + file);
const archived = read('.tmp/s03-offline-repair-20260908/prior-051-archive.json');
assert.equal(archived.exactCopiesVerified, true);
assert.equal(sha(bytes(archived.archivedPath + '/artifact.json')), archived.artifactSha256);
assert.equal(git(['rev-parse', 'HEAD']).trim(), expectedSourceCommit);
assert.equal(git(['status', '--porcelain=v1', '--untracked-files=normal', '--', ...trackedInputs, ...supportInputs.filter(name => !name.startsWith('.tmp/'))]).trim(), '', 'Source must be committed and clean');
const before = snapshot(), supportBefore = supportSnapshot();
fs.mkdirSync(safe(output, false));
const save = (name, value) => fs.writeFileSync(safe(output + '/' + name, false), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('source-before.json', before); save('support-before.json', supportBefore);
function command(name, commandArgs) {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(safe(output + '/' + name + '.log', false), { flags: 'wx' });
    const started = Date.now(), child = spawn(process.execPath, commandArgs, { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { log.write(data); }); child.stderr.on('data', data => { log.write(data); });
    child.once('error', error => { log.end(); reject(error); });
    child.once('close', code => { log.end(() => {
      save(name + '-execution.json', { command: [process.execPath, ...commandArgs], exitCode: code, durationMs: Date.now() - started });
      resolve(code);
    }); });
  });
}
let server, artifact, strictPassed = false, browserExit = null, failure = null;
try {
  server = await startPwaQaServer({ port: settings.port, authorityPath: settings.authorityPath, controlPath: settings.controlPath, buildQa: true });
  artifact = read('dist-pwa/artifact.json');
  assert.equal(artifact.sourceCommit, expectedSourceCommit); assert.equal(artifact.localQaAuthority, true); assert.equal(artifact.releaseReady, false);
  assert.deepEqual(artifact.sourceInputs.files, before);
  save('session.json', { schemaVersion: 1, runId, localQaOnly: true, origin: settings.origin,
    artifact: { buildId: artifact.buildId, sourceCommit: artifact.sourceCommit, sourceInputsSha256: artifact.sourceInputs.sha256,
      authoritySha256: artifact.authoritySha256, localQaAuthority: true, releaseReady: false },
    planned: { oneScenario: true, projects: ['pwa-desktop', 'pwa-mobile'], executions: 2, workers: 1, retries: 0 },
    limits: ['Ephemeral signer exists only in this local process. No provider/payment or installed OS evidence.',
      'One new build for the changed offline-repair and shared source. Previous051 remains archived.'] });
  const auditExit = await command('strict-artifact-audit', ['scripts/mobile/verify-pwa-artifact.mjs', '--allow-qa']);
  assert.equal(auditExit, 0, 'Strict audit process failed');
  const audit = read(output + '/strict-artifact-audit.log');
  assert.equal(audit.pass, true); assert.equal(audit.identity.buildId, artifact.buildId); assert.equal(audit.identity.sourceCommit, expectedSourceCommit);
  save('strict-artifact-audit.json', audit); strictPassed = true;
  browserExit = await command('browser-run', ['node_modules/@playwright/test/cli.js', 'test', '--config=.tmp/s03-offline-repair-20260908/playwright.repair.config.mjs']);
} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) { await server.close(); save('server-closed.json', { gracefulClose: true, closedAt: new Date().toISOString(), localQaOnly: true }); }
  const after = snapshot(), supportAfter = supportSnapshot(), finalHead = git(['rev-parse', 'HEAD']).trim();
  save('source-after.json', after); save('support-after.json', supportAfter);
  const unchanged = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(supportBefore) === JSON.stringify(supportAfter) && finalHead === expectedSourceCommit;
  save('source-comparison.json', { sourceFiles: before.length, supportFiles: supportBefore.length, unchangedDuringRun: unchanged, expectedSourceCommit, finalHead });
  let stats = null;
  if (fs.existsSync(safe(output + '/results.json', false))) stats = read(output + '/results.json').stats;
  const pass = !failure && strictPassed && browserExit === 0 && unchanged && stats?.expected === 2 && stats.unexpected === 0 && stats.flaky === 0 && stats.skipped === 0;
  save('run-result.json', { schemaVersion: 1, runId, sourceCommit: expectedSourceCommit, buildId: artifact?.buildId ?? null,
    strictArtifactAuditPassed: strictPassed, browserExitCode: browserExit, statistics: stats, failure, sourceUnchanged: unchanged,
    pass, stageAccepted: false, releaseReady: false, installedRuntimeVerified: false, productionActionsPerformed: false });
  console.log(JSON.stringify({ runId, buildId: artifact?.buildId ?? null, strictPassed, browserExit, stats, pass }));
  if (!pass) process.exitCode = 1;
}
