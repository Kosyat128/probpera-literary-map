import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { guardBuild } from './guard-build.mjs';
const bound = await guardBuild(process.argv.slice(2));
const { root, sourceManifest, verifySource } = bound;
// Each standalone invocation owns its Git environment; no global config change.
Object.assign(process.env, { GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'safe.directory',
  GIT_CONFIG_VALUE_0: 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',
  GIT_CONFIG_KEY_1: 'core.autocrlf', GIT_CONFIG_VALUE_1: 'false',
  GIT_CONFIG_KEY_2: 'safe.directory', GIT_CONFIG_VALUE_2: 'D:/CodexProjects/Работа по сайту/literary-planet-v12-work' });
const evidence = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-reader-foreground-review/runtime-build-review-a1', out = evidence + '/android-a1';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const parse = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sourceCommit = process.argv[2];
assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
assert.equal(process.argv.length, 5);
assert.equal(await fs.realpath('.'), await fs.realpath(root));
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, maxBuffer:64*1024*1024 }).trim(), sourceCommit);
const artifactBytes = await fs.readFile('dist-native/artifact.json'), artifact = JSON.parse(artifactBytes);

  const artwork = { path: 'src/assets/mascots/knizhulyk-green-v1.png', sha256: '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed', bytes: 1895595 };
  assert.ok(artifact.sourceInputs.files.some(item => item.path === artwork.path && item.sha256 === artwork.sha256));
  assert.equal(artifact.inventory.filter(item => item.sha256 === artwork.sha256 && item.bytes === artwork.bytes && item.path.endsWith('.png')).length, 1);
const audit = await parse(out + '/android-dev-apk-verification.json'), build = await parse(out + '/build-run.json');
assert.ok(audit.pass && build.pass); assert.equal(artifact.sourceCommit, sourceCommit); assert.equal(build.buildId, artifact.buildId);
assert.equal(build.sourceCommit, sourceCommit); assert.equal(audit.sourceArtifact.sourceCommit, sourceCommit);
assert.equal(audit.sourceArtifact.buildId, artifact.buildId); assert.equal(audit.sourceArtifact.sha256, sha(artifactBytes));
const base = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-reader-foreground-runtime-build-evidence/attempt-a1/android';
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
const priorRef={path:root+'/docs/mobile/evidence/S15/booky-globe-focus-race-20260930/android-a2/result.json',sha256:'43d4da3e44e036fd263e0cf5e6873d45e7e03f30926c19b75d1c98de5e713735'};
assert.equal(sha(await fs.readFile(priorRef.path)),priorRef.sha256);const previous=await parse(priorRef.path);
assert.equal(previous.pass,true);assert.equal(previous.sourceCommit,'dd041380a75da0c1349908c1dd7a8269f22cc981');assert.equal(previous.buildId,'c416812961560d90801ad7f5bfe4892a67b682dfc2498abdee5ad47fb68f25df');assert.equal(previous.checks.exactCopiedBytes,true);
assert.ok((await fs.stat(previous.artifact.path)).isDirectory());assert.ok((await fs.stat(path.dirname(previous.apk.path))).isDirectory());
for (const input of artifact.sourceInputs.files) assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
// The full manifest is already preserved and byte-verified under target/runtime.
// Keep only its hash/path in the small tracked result, not another inventory copy.
await verifySource();
const result = { schemaVersion: 1, pass: true, kind: 'android-booky-reader-foreground-runtime-dev-apk', sourceCommit, sourceManifest, buildId: artifact.buildId,
  sourceInputsSha256: artifact.sourceInputs.sha256,
  apk: { path: target + '/app-dev-debug.apk', bytes: copiedApk.length, sha256: sha(copiedApk) },
  artifact: { path: target + '/runtime', sha256: sha(artifactBytes), files: records.length,
    bytes: records.reduce((sum, record) => sum + record.bytes, 0) },
  checks: { strictRuntimeAudit: out + '/native-artifact-audit.json', binaryAudit: out + '/android-dev-apk-verification.json',
    build: out + '/build-run.json', exactCopiedBytes: true, priorAcceptedReportAuthenticated:true,
    priorPreservedDirectoriesPresent: true, priorExactCopyVerificationRecorded: true, priorRuntimePayloadHashesRechecked: false, originalPriorAuthenticationRetained:true,
    bundledAssetsMatched: audit.bundledAssets.matched, localContentStoreDex: audit.dex.localContentStore.dex },
  priorAndroid: {result:priorRef,sourceCommit:previous.sourceCommit,buildId:previous.buildId,apkPath:previous.apk.path}, nativeExecutionVerified: false, iosCompiled: false, stageAccepted: false, releaseReady: false,
  productionActionsPerformed: false, canonicalOwnerArchiveSyncPerformed: false };
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json({pass:result.pass,sourceCommit:result.sourceCommit,buildId:result.buildId,kind:result.kind,apk:result.apk,runtimeFiles:result.artifact.files,resultPath:out+'/result.json'}));
