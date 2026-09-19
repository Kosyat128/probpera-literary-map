import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const evidence = 'docs/mobile/evidence/S13/three-whales-20260919', out = evidence + '/android-a1';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const parse = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const artifactBytes = await fs.readFile('dist-native/artifact.json'), artifact = JSON.parse(artifactBytes);
const audit = await parse(out + '/android-dev-apk-verification.json'), build = await parse(out + '/build-run.json');
assert.ok(audit.pass && build.pass); assert.equal(artifact.sourceCommit, sourceCommit); assert.equal(build.buildId, artifact.buildId);
const base = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-wh';
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
const previous = await parse('docs/mobile/evidence/S13/surface-realism-20260919/android-a1/result.json');
assert.equal(previous.pass, true);
assert.equal(previous.buildId, 'aea111e44ba84f5afbd3e29eb19db9338f81c72b872ebcd37dd7ecf0a5b31b24');
assert.equal(previous.checks.exactCopiedBytes, true);
assert.ok((await fs.stat(previous.artifact.path)).isDirectory());
assert.ok((await fs.stat(path.dirname(previous.apk.path))).isDirectory());
assert.equal(sha(await fs.readFile(previous.apk.path)), previous.apk.sha256);
assert.equal(sha(await fs.readFile(previous.artifact.path + '/artifact.json')), previous.artifact.sha256);
const priorRuntime = await parse(previous.artifact.path + '/artifact.json');
assert.equal(priorRuntime.buildId, previous.buildId);
await fs.writeFile(out + '/native-artifact.json', artifactBytes, { flag: 'wx' });
const result = { schemaVersion: 1, pass: true, kind: 'android-golden-three-whales-dev-apk', sourceCommit, buildId: artifact.buildId,
  sourceInputsSha256: artifact.sourceInputs.sha256,
  apk: { path: target + '/app-dev-debug.apk', bytes: copiedApk.length, sha256: sha(copiedApk) },
  artifact: { path: target + '/runtime', sha256: sha(artifactBytes), files: records.length,
    bytes: records.reduce((sum, record) => sum + record.bytes, 0) },
  checks: { strictRuntimeAudit: out + '/native-artifact-audit.json', binaryAudit: out + '/android-dev-apk-verification.json',
    build: out + '/build-run.json', exactCopiedBytes: true, priorAndroidApkAndManifestVerified: true,
    priorPreservedDirectoriesPresent: true, priorExactCopyVerificationRecorded: true, priorRuntimePayloadHashesRechecked: false,
    bundledAssetsMatched: audit.bundledAssets.matched, localContentStoreDex: audit.dex.localContentStore.dex },
  priorAndroid: previous.apk.path, nativeExecutionVerified: false, iosCompiled: false, stageAccepted: false, releaseReady: false,
  productionActionsPerformed: false, canonicalOwnerArchiveSyncPerformed: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json(result));
