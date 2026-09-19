import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { startPwaQaServer } from '../../../../../tests/pwa/support/local-server.mjs';
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const [expectedSource] = process.argv.slice(2); assert.match(expectedSource, /^[a-f0-9]{40}$/u);
const folder = 'docs/mobile/evidence/S13/library-background-20260919', out = folder + '/pwa-a1';
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out);
const artifactRoot = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-lb';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = (name, value) => fs.writeFile(out + '/' + name, json(value), { flag: 'wx' });
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(git(['rev-parse', 'HEAD']), expectedSource);
assert.equal(git(['status', '--porcelain', '--', 'src', 'scripts/mobile/build-pwa.mjs', 'scripts/mobile/pwa-artifact.mjs', 'package.json', 'package-lock.json']), '');
const old = await read('docs/mobile/evidence/S13/stand-customization-20260919/pwa-a1/result.json');
assert.equal(old.pass, true);
assert.equal(old.buildId, '7aba859f0ac4e526b17af00edfb6fd03c64b64ec90924d9f5f9bb8f6f110206f');
assert.equal(old.artifact.exactCopiesVerified, true);
assert.ok((await fs.stat(old.artifact.path)).isDirectory());
assert.equal(sha(await fs.readFile('dist-pwa/artifact.json')), old.artifact.artifactSha256);
assert.equal(sha(await fs.readFile(old.artifact.path + '/artifact.json')), old.artifact.artifactSha256);
const oldArtifact = await read('dist-pwa/artifact.json');
assert.equal(oldArtifact.buildId, old.buildId);
await save('prior-preservation.json', { buildId: oldArtifact.buildId, files: oldArtifact.inventory.length + 1,
  previousResult: 'docs/mobile/evidence/S13/stand-customization-20260919/pwa-a1/result.json',
  currentAndPreservedManifestVerified: true, priorPreservedDirectoryPresent: true,
  priorExactCopyVerificationRecorded: true, priorRuntimePayloadHashesRechecked: false });
Object.assign(process.env, { TEMP: artifactRoot + '/temp', TMP: artifactRoot + '/temp',
  PWA_QA_CONTROL_PATH: '.tmp/pwa-qa/s13-lb-20260919-server.json', PWA_QA_ORIGIN: 'http://127.0.0.1:4301',
  S13_PWA_OUTPUT: artifactRoot + '/pwa-a1', S13_PWA_REPORT: path.resolve(out, 'playwright.json') });
for (const filename of [process.env.PWA_QA_CONTROL_PATH, '.tmp/pwa-qa/s13-lb-20260919-authority.json']) await assert.rejects(fs.stat(filename), { code: 'ENOENT' });
async function command(name, args) {
  const began = Date.now(), stdout = [], stderr = [];
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
    child.once('error', reject); child.once('exit', resolve);
  });
  await save(name + '-execution.json', { command: [process.execPath, ...args], exitCode: code, durationMs: Date.now() - began,
    stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
  assert.equal(code, 0, name + ' failed'); return Buffer.concat(stdout).toString('utf8');
}
let server, artifact, failure = null, preserved = null, browser = null;
try {
  server = await startPwaQaServer({ port: 4301, buildQa: true,
    authorityPath: '.tmp/pwa-qa/s13-lb-20260919-authority.json', controlPath: process.env.PWA_QA_CONTROL_PATH });
  artifact = await read('dist-pwa/artifact.json'); assert.equal(artifact.sourceCommit, expectedSource);
  const audit = JSON.parse(await command('strict-audit', ['scripts/mobile/verify-pwa-artifact.mjs', '--allow-qa']));
  assert.equal(audit.pass, true); await save('strict-audit.json', audit);
  await command('browser', ['node_modules/@playwright/test/cli.js', 'test', '--config=' + folder + '/pwa.config.mjs']);
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
  await save('copy-verification.json', { pass: true, files });
} catch (error) { failure = { name: error.name, message: error.message }; }
finally {
  if (server) await server.close();
  const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), sourceCommit: expectedSource, buildId: artifact?.buildId,
    sourceInputsSha256: artifact?.sourceInputs?.sha256, artifact: preserved, browser, pass: !failure && !!preserved, failure,
    localQaAuthority: true, stageAccepted: false, installedDevice: false, releaseReady: false, productionActionsPerformed: false };
  await save('result.json', result); console.log(json(result)); if (!result.pass) process.exitCode = 1;
}
