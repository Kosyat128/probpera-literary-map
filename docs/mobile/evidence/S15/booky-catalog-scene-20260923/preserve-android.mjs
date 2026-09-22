import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const evidence = 'docs/mobile/evidence/S15/booky-catalog-scene-20260923', out = evidence + '/android-a1';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const parse = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(process.argv.length, 3);
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const artifactBytes = await fs.readFile('dist-native/artifact.json'), artifact = JSON.parse(artifactBytes);

  const artwork = { path: 'src/assets/mascots/knizhulyk-green-v1.png', sha256: '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed', bytes: 1895595 };
  assert.ok(artifact.sourceInputs.files.some(item => item.path === artwork.path && item.sha256 === artwork.sha256));
  assert.equal(artifact.inventory.filter(item => item.sha256 === artwork.sha256 && item.bytes === artwork.bytes && item.path.endsWith('.png')).length, 1);
const audit = await parse(out + '/android-dev-apk-verification.json'), build = await parse(out + '/build-run.json');
assert.ok(audit.pass && build.pass); assert.equal(artifact.sourceCommit, sourceCommit); assert.equal(build.buildId, artifact.buildId);
assert.equal(build.sourceCommit, sourceCommit); assert.equal(audit.sourceArtifact.sourceCommit, sourceCommit);
assert.equal(audit.sourceArtifact.buildId, artifact.buildId); assert.equal(audit.sourceArtifact.sha256, sha(artifactBytes));
const base = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-catalog-scene';
const target = base + '/android-' + artifact.buildId.slice(0, 8);
await assert.rejects(fs.stat(target), { code: 'ENOENT' });
await fs.mkdir(target, { recursive: true }); assert.equal((await fs.realpath(target)).replaceAll('\\', '/'), target);
await fs.cp('dist-native', target + '/runtime', { recursive: true, errorOnExist: true, force: false });
await fs.copyFile(audit.apk.path, target + '/app-dev-debug.apk', fs.constants.COPYFILE_EXCL);
const records = [...artifact.inventory, { path: 'artifact.json', bytes: artifactBytes.length, sha256: sha(artifactBytes) }];
async function walk(folder, prefix = '') {
  const entries = await fs.readdir(folder, { withFileTypes: true }), names = [];
  for (const entry of entries) {
    assert.ok(!entry.isSymbolicLink());
    if (entry.isDirectory()) names.push(...await walk(path.join(folder, entry.name), prefix + entry.name + '/'));
    else { assert.ok(entry.isFile()); names.push(prefix + entry.name); }
  }
  return names;
}
assert.deepEqual((await walk(target + '/runtime')).sort(), records.map(record => record.path).sort());
for (const record of records) {
  const bytes = await fs.readFile(target + '/runtime/' + record.path);
  assert.equal(bytes.length, record.bytes); assert.equal(sha(bytes), record.sha256);
}
const copiedApk = await fs.readFile(target + '/app-dev-debug.apk');
assert.equal(copiedApk.length, audit.apk.bytes); assert.equal(sha(copiedApk), audit.apk.sha256);
const entry = await parse(evidence + '/entry.json');
assert.equal(sha(await fs.readFile(entry.priorAndroid.path)), entry.priorAndroid.sha256);
const previous = await parse(entry.priorAndroid.path);
assert.equal(previous.pass, true);
assert.equal(previous.buildId, entry.priorAndroid.buildId); assert.equal(previous.sourceCommit, entry.priorAndroid.sourceCommit);
assert.equal(previous.checks.exactCopiedBytes, true);
assert.ok((await fs.stat(previous.artifact.path)).isDirectory());
assert.ok((await fs.stat(path.dirname(previous.apk.path))).isDirectory());
assert.equal(sha(await fs.readFile(previous.apk.path)), previous.apk.sha256);
assert.equal(sha(await fs.readFile(previous.artifact.path + '/artifact.json')), previous.artifact.sha256);
const priorRuntime = await parse(previous.artifact.path + '/artifact.json');
assert.equal(priorRuntime.buildId, previous.buildId);
assert.equal(priorRuntime.sourceCommit, entry.priorAndroid.sourceCommit);
for (const input of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
for (const input of priorRuntime.inventory) {
  const bytes = await fs.readFile(path.join(previous.artifact.path, input.path));
  assert.equal(bytes.length, input.bytes); assert.equal(sha(bytes), input.sha256, input.path);
}
// The full manifest is already preserved and byte-verified under target/runtime.
// Keep only its hash/path in the small tracked result, not another inventory copy.
const result = { schemaVersion: 1, pass: true, kind: 'android-booky-catalog-scene-dev-apk', sourceCommit, buildId: artifact.buildId,
  sourceInputsSha256: artifact.sourceInputs.sha256,
  apk: { path: target + '/app-dev-debug.apk', bytes: copiedApk.length, sha256: sha(copiedApk) },
  artifact: { path: target + '/runtime', sha256: sha(artifactBytes), files: records.length,
    bytes: records.reduce((sum, record) => sum + record.bytes, 0) },
  checks: { strictRuntimeAudit: out + '/native-artifact-audit.json', binaryAudit: out + '/android-dev-apk-verification.json',
    build: out + '/build-run.json', exactCopiedBytes: true, priorAndroidApkAndManifestVerified: true,
    priorPreservedDirectoriesPresent: true, priorExactCopyVerificationRecorded: true, priorRuntimePayloadHashesRechecked: true,
    bundledAssetsMatched: audit.bundledAssets.matched, localContentStoreDex: audit.dex.localContentStore.dex },
  priorAndroid: previous.apk.path, nativeExecutionVerified: false, iosCompiled: false, stageAccepted: false, releaseReady: false,
  productionActionsPerformed: false, canonicalOwnerArchiveSyncPerformed: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json(result));
