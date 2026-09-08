import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fs.realpathSync(process.cwd());
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const runId = 's03-graphics-quality-native-20260908-a1';
const helper = '.tmp/' + runId + '/run.mjs';
const reports = '.tmp/' + runId + '/reports';
const browserOutput = '.tmp/native-planet-browser-results/' + runId;
const evidence = '.tmp/' + runId + '/evidence';
const title = 'native application defaults to rich graphics under low-resource hints while respecting reduced motion and RU/EN scene identity';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';
function safe(relative, existing = true) {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative));
  const absolute = path.resolve(root, relative), local = path.relative(root, absolute);
  assert.ok(local && !local.startsWith('..') && !path.isAbsolute(local));
  if (existing) { assert.equal(fs.realpathSync(absolute), absolute); assert.equal(fs.lstatSync(absolute).isSymbolicLink(), false); }
  return absolute;
}
const read = relative => fs.readFileSync(safe(relative));
const json = relative => JSON.parse(read(relative).toString('utf8').replace(/^\uFEFF/, ''));
const exists = relative => fs.existsSync(safe(relative, false));
const save = (relative, value) => fs.writeFileSync(safe(relative, false), encode(value), { flag: 'wx' });
for (const target of [reports, browserOutput, evidence]) assert.equal(exists(target), false, 'Refusing historical output: ' + target);
fs.mkdirSync(safe(reports, false));
const environment = { ...process.env, NATIVE_PLANET_RUN_ID: runId,
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root.replaceAll('\\', '/') };
const git = args => execFileSync('git', args, { cwd: root, env: environment, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const sourcePaths = ['src', 'native.html', 'vite.native.config.ts', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'capacitor.config.json',
  'scripts/mobile/build-native.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-artifact.mjs'];
function sourceSnapshot() {
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...sourcePaths]).split('\0');
  const files = [...new Set(paths)].filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)).sort()
    .map(name => ({ path: name, sha256: sha(read(name)) }));
  return { sha256: sha(encode(files)), files };
}
const testPaths = ['tests/host/native-planet.spec.mjs', 'playwright.native-planet.config.mjs'];
const testSnapshot = () => testPaths.map(name => ({ path: name, sha256: sha(read(name)) }));
const startingHead = git(['rev-parse', 'HEAD']).trim();
const before = sourceSnapshot(), testBefore = testSnapshot();
save(reports + '/source-before.json', before); save(reports + '/test-config-before.json', testBefore);
save(reports + '/run-context.json', { runId, startingHead, sourcePaths, sourceInputsSha256: before.sha256,
  inputSnapshotConvention: 'Exact build-native.mjs input selection; this runner does not invoke that builder',
  helper: { path: helper, sha256: sha(read(helper)) },
  dependency: { path: 'node_modules/@noble/hashes/package.json', sha256: sha(read('node_modules/@noble/hashes/package.json')),
    declared: json('package.json').dependencies['@noble/hashes'], installed: json('node_modules/@noble/hashes/package.json').version },
  testScopeRefactor: json('.tmp/native-graphics-profile-final-preparation-20260908.json'),
  headMayAdvanceForRootCommit: true, requiredSourceAndTestBytesUnchanged: true,
  kind: 'canonical-native-app-source-in-Chrome', productionArtifactBuilds: 0, actualInstalledRuntime: false });
async function command(name, args) {
  const startedAt = new Date().toISOString(), started = Date.now(), stdout = [], stderr = [], merged = [];
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { stdout.push(data); merged.push(data); });
    child.stderr.on('data', data => { stderr.push(data); merged.push(data); });
    child.once('error', reject); child.once('close', resolve);
  });
  for (const [suffix, chunks] of [['stdout.log', stdout], ['stderr.log', stderr], ['log', merged]]) {
    fs.writeFileSync(safe(reports + '/' + name + '.' + suffix, false), Buffer.concat(chunks), { flag: 'wx' });
  }
  save(reports + '/' + name + '-execution.json', { command: [process.execPath, ...args], startedAt, durationMs: Date.now() - started, exitCode: code });
  return { code, stdout: Buffer.concat(stdout).toString('utf8') };
}
const selected = [];
function collect(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) selected.push({ title: spec.title, test });
    collect(suite.suites ?? []);
  }
}
const args = ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.native-planet.config.mjs', '--grep', title];
let failure = null, browserExit = null, stats = null;
try {
  const discovery = await command('discovery', [...args, '--list', '--reporter=json']);
  assert.equal(discovery.code, 0);
  collect(JSON.parse(discovery.stdout).suites ?? []);
  assert.equal(selected.length, 1); assert.equal(selected[0].title, title);
  save(reports + '/discovery.json', { selectedCount: selected.length, title, actualBrowserExecutions: 0 });
  const run = await command('browser-run', args); browserExit = run.code;
  stats = json(browserOutput + '/results.json').stats;
} catch (error) { failure = { name: error.name, message: error.message }; }
const after = sourceSnapshot(), testAfter = testSnapshot(), endingHead = git(['rev-parse', 'HEAD']).trim();
save(reports + '/source-after.json', after); save(reports + '/test-config-after.json', testAfter);
const unchanged = before.sha256 === after.sha256 && JSON.stringify(testBefore) === JSON.stringify(testAfter);
save(reports + '/source-comparison.json', { startingHead, endingHead, headChanged: startingHead !== endingHead,
  sourceFiles: before.files.length, testConfigFiles: testBefore.length, sourceBeforeSha256: before.sha256,
  sourceAfterSha256: after.sha256, unchangedDuringRun: unchanged });
const pass = !failure && browserExit === 0 && unchanged && stats?.expected === 1 && stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0;
save(reports + '/run-result.json', { schemaVersion: 1, runId, title, startingHead, endingHead, sourceInputsSha256: before.sha256,
  sourceUnchanged: unchanged, browserExitCode: browserExit, statistics: stats, failure, pass,
  productionArtifactBuilds: 0, actualInstalledRuntime: false, stageAccepted: false, releaseReady: false });

// Preserve original bytes plus reversible UTF-8 transcripts. Never retain a
// native signer, OS account data, private trace or unrelated screenshot.
fs.mkdirSync(safe(evidence, false));
const preserved = [];
function copy(source, destination) {
  const bytes = read(source); fs.writeFileSync(safe(destination, false), bytes, { flag: 'wx' }); assert.deepEqual(read(destination), bytes);
  preserved.push({ source, path: destination, bytes: bytes.length, sha256: sha(bytes) });
}
for (const name of fs.readdirSync(safe(reports))) {
  const source = reports + '/' + name;
  if (name.endsWith('.json')) copy(source, evidence + '/' + name);
  else if (name.endsWith('.log')) {
    const bytes = read(source), text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.deepEqual(Buffer.from(text, 'utf8'), bytes);
    assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|"controlToken"\s*:/u.test(text));
    const destination = evidence + '/' + name.replace(/\.log$/, '-transcript.json');
    save(destination, { source, originalBytes: bytes.length, originalSha256: sha(bytes),
      reconstruction: 'UTF-8 encode text exactly without newline normalization', text });
    assert.deepEqual(Buffer.from(json(destination).text, 'utf8'), bytes);
    preserved.push({ source, path: destination, bytes: read(destination).length, sha256: sha(read(destination)), rawSha256: sha(bytes), lossless: true });
  }
}
copy(helper, evidence + '/runner.mjs');
const interpretations = [];
if (exists(browserOutput + '/results.json')) {
  copy(browserOutput + '/results.json', evidence + '/results.json');
  selected.length = 0; collect(json(browserOutput + '/results.json').suites ?? []);
  for (const item of selected) {
    assert.equal(item.title, title);
    const result = item.test.results.at(-1);
    interpretations.push({ title: item.title, expectedStatus: item.test.expectedStatus, status: result.status, durationMs: result.duration, errors: result.errors ?? [] });
    for (const attachment of result.attachments ?? []) {
      if (attachment.contentType === 'application/json' && attachment.name.startsWith('native-graphics-')) {
        const destination = evidence + '/' + attachment.name + '.json';
        if (attachment.body) {
          const bytes = Buffer.from(attachment.body, 'base64'); JSON.parse(bytes);
          fs.writeFileSync(safe(destination, false), bytes, { flag: 'wx' });
          preserved.push({ source: browserOutput + '/results.json#' + attachment.name, path: destination, bytes: bytes.length, sha256: sha(bytes) });
        } else if (attachment.path) {
          const relative = path.relative(root, path.resolve(root, attachment.path)).replaceAll('\\', '/');
          assert.ok(relative.startsWith(browserOutput + '/artifacts/')); copy(relative, destination);
        }
      }
    }
  }
  function screenshots(directory) {
    for (const entry of fs.readdirSync(safe(directory), { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false);
      const source = directory + '/' + entry.name;
      if (entry.isDirectory()) screenshots(source);
      else if (/^native-graphics-[a-z-]+\.png$/.test(entry.name)) copy(source, evidence + '/' + entry.name);
    }
  }
  if (exists(browserOutput + '/artifacts')) screenshots(browserOutput + '/artifacts');
}
save(evidence + '/result.json', { schemaVersion: 1, runId, status: pass ? 'SELECTED_SOURCE_BROWSER_VALIDATION_PASSED' : 'SELECTED_SOURCE_BROWSER_VALIDATION_FAILED',
  startingHead, endingHead, sourceInputsSha256: before.sha256, sourceUnchanged: unchanged, statistics: stats, executions: interpretations,
  preservedFiles: preserved, actualApp: true, nativePluginsSimulated: true, productionArtifactBuilds: 0,
  actualInstalledRuntime: false, stageAccepted: false, releaseReady: false,
  scope: 'One graphics profile case: low-resource hints default High, actual DPR/star buffers/sphere segments/sky material across all profiles; same scene and selection across profiles/locales; native preference reload; reduced motion; keyboard focus; RU/EN labels and 320px/200% text. Source bundled by esbuild in memory.',
  limits: ['No dist-native/Vite/Android/iOS artifact runtime or installed-device evidence.', 'No full appearance/offline regression or physical GPU/performance certification. Settings copy remains draft.'] });
console.log(JSON.stringify({ runId, pass, statistics: stats, startingHead, endingHead, sourceUnchanged: unchanged,
  sourceInputsSha256: before.sha256, evidence: evidence + '/result.json', productionArtifactBuilds: 0 }));
if (!pass) process.exitCode = 1;
