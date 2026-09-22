import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { startPwaQaServer } from '../../../../../tests/pwa/support/local-server.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const [expectedSource, ...extra] = process.argv.slice(2); assert.match(expectedSource, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
const folder = 'docs/mobile/evidence/S15/journey-runtime-20260923', out = folder + '/pwa-a1';
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out);
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-journey-runtime';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = (name, value) => fs.writeFile(out + '/' + name, json(value), { flag: 'wx' });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(git(['rev-parse', 'HEAD']), expectedSource);
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'src', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'vite.pwa.config.ts', 'data/book-canon-source-registry.json',
  'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/pwa-portrait-selection.mjs',
  'scripts/mobile/pwa-shell.mjs', 'scripts/mobile/native-base-assets.json']), '');
const entry = await read(folder + '/build-baseline.json');
assert.equal(sha(await fs.readFile(entry.priorPwa.path)), entry.priorPwa.sha256);
const old = await read(entry.priorPwa.path);
assert.equal(old.pass, true);
assert.equal(old.buildId, entry.priorPwa.buildId); assert.equal(old.sourceCommit, entry.priorPwa.sourceCommit);
assert.equal(old.artifact.exactCopiesVerified, true);
assert.ok((await fs.stat(old.artifact.path)).isDirectory());
assert.equal(sha(await fs.readFile('dist-pwa/artifact.json')), old.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(old.artifact.path + '/artifact.json')), old.artifact.artifactSha256);
const oldArtifact = await read('dist-pwa/artifact.json');
assert.equal(oldArtifact.buildId, old.buildId);
assert.equal(oldArtifact.sourceCommit, entry.priorPwa.sourceCommit);
for (const item of oldArtifact.inventory) {
  const bytes = await fs.readFile(path.join(old.artifact.path, item.path));
  assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256, item.path);
}
await save('prior-preservation.json', { buildId: oldArtifact.buildId, files: oldArtifact.inventory.length + 1,
  sourceCommit: oldArtifact.sourceCommit, previousResult: entry.priorPwa.path,
  currentAndPreservedManifestVerified: true, priorPreservedDirectoryPresent: true,
  priorExactCopyVerificationRecorded: true, priorRuntimePayloadHashesRechecked: true });
Object.assign(process.env, { TEMP: artifactRoot + '/temp', TMP: artifactRoot + '/temp',
  PWA_QA_CONTROL_PATH: '.tmp/pwa-qa/s15-journey-runtime-20260923-a1-server.json', PWA_QA_ORIGIN: 'http://127.0.0.1:4301',
  S15_PWA_OUTPUT: artifactRoot + '/pwa-a1', S15_PWA_REPORT: path.resolve(out, 'playwright.json') });
await fs.mkdir(process.env.TEMP, { recursive: true });
for (const filename of [process.env.PWA_QA_CONTROL_PATH, '.tmp/pwa-qa/s15-journey-runtime-20260923-a1-authority.json']) await assert.rejects(fs.stat(filename), { code: 'ENOENT' });
async function command(name, args) {
  const began = Date.now(), stdout = [], stderr = [];
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
    child.once('error', reject); child.once('exit', resolve);
  });
  const logs = {};
  for (const [stream, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
    const file = out + '/' + name + '-' + stream + '.log', bytes = Buffer.concat(chunks);
    await fs.writeFile(file, bytes, { flag: 'wx' }); logs[stream] = { path: file, bytes: bytes.length, sha256: sha(bytes) };
  }
  await save(name + '-execution.json', { command: [process.execPath, ...args], exitCode: code, durationMs: Date.now() - began, ...logs });
  assert.equal(code, 0, name + ' failed'); return Buffer.concat(stdout).toString('utf8');
}
let server, artifact, failure = null, preserved = null, browser = null;
try {
  server = await startPwaQaServer({ port: 4301, buildQa: true,
    authorityPath: '.tmp/pwa-qa/s15-journey-runtime-20260923-a1-authority.json', controlPath: process.env.PWA_QA_CONTROL_PATH });
  artifact = await read('dist-pwa/artifact.json'); assert.equal(artifact.sourceCommit, expectedSource);
  const artwork = { path: 'src/assets/mascots/knizhulyk-green-v1.png', sha256: '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed', bytes: 1895595 };
  assert.ok(artifact.sourceInputs.files.some(item => item.path === artwork.path && item.sha256 === artwork.sha256));
  assert.equal(artifact.inventory.filter(item => item.sha256 === artwork.sha256 && item.bytes === artwork.bytes && item.path.endsWith('.png')).length, 1);
  const audit = JSON.parse(await command('strict-audit', ['scripts/mobile/verify-pwa-artifact.mjs', '--allow-qa']));
  assert.equal(audit.pass, true); await save('strict-audit.json', audit);
  await command('browser', ['node_modules/@playwright/test/cli.js', 'test', '--config=' + folder + '/pwa-a1.config.mjs']);
  browser = (await read(out + '/playwright.json')).stats;
  assert.deepEqual([browser.expected, browser.unexpected, browser.skipped, browser.flaky], [1, 0, 0, 0]);
  const destination = artifactRoot + '/pwa-' + artifact.buildId.slice(0, 8);
  assert.ok(path.resolve(destination).startsWith(path.resolve(artifactRoot) + path.sep));
  await assert.rejects(fs.stat(destination), { code: 'ENOENT' }); await fs.cp('dist-pwa', destination, { recursive: true, errorOnExist: true, force: false });
  const files = [];
  for (const entry of [...artifact.inventory, { path: 'artifact.json', sha256: sha(await fs.readFile('dist-pwa/artifact.json')) }]) {
    const bytes = await fs.readFile(path.join(destination, entry.path)); assert.equal(sha(bytes), entry.sha256);
    files.push({ path: entry.path, bytes: bytes.length, sha256: entry.sha256 });
  }
  for (const input of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  assert.equal(git(['rev-parse', 'HEAD']), expectedSource);
  preserved = { path: destination, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    artifactSha256: sha(await fs.readFile(destination + '/artifact.json')), exactCopiesVerified: true };
  const ledgerPath = artifactRoot + '/pwa-a1-copy-verification.json', ledgerBytes = json({ pass: true, files });
  await fs.writeFile(ledgerPath, ledgerBytes, { flag: 'wx' });
  await save('copy-verification.json', { pass: true, files: preserved.files, bytes: preserved.bytes,
    detailedLedger: { path: ledgerPath, sha256: sha(ledgerBytes) }, artifactManifest: { path: destination + '/artifact.json', sha256: preserved.artifactSha256 } });
} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) await server.close();
  const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), sourceCommit: expectedSource, buildId: artifact?.buildId,
    sourceInputsSha256: artifact?.sourceInputs?.sha256, artifact: preserved, browser, pass: !failure && !!preserved, failure,
    localQaAuthority: true, stageAccepted: false, installedDevice: false, releaseReady: false, productionActionsPerformed: false };
  await save('result.json', result); console.log(json(result)); if (!result.pass) process.exitCode = 1;
}
