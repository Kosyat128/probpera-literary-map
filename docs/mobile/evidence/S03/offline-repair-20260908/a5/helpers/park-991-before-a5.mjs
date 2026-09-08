import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// PREPARED ONLY: run after root authorizes the new committed PWA candidate.
// Retain the current runtime by same-workspace rename; never delete/overwrite.
const root = fs.realpathSync(process.cwd());
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const args = process.argv.slice(2);
assert.deepEqual(args, ['--park-exact-991-before-a5']);
const buildId = '991973aa7cb2dde03c8acfbf5c39da110150da8fd31e08ce563c69e74cb95536';
const artifactSha256 = 'c90e757676ad39eb58c7d3675e4f980e3eab708a47a1ccd313ce5d82db7a0bfa';
const sourcePath = 'dist-pwa';
const existingArchive = '.tmp/pwa-artifacts/991973aa-offline-repair-20260908-a4';
const parkedPath = '.tmp/pwa-artifacts/991973aa-before-edition-cache-20260908-a5';
const receipt = '.tmp/s03-offline-repair-20260908/prior-991-before-a5.json';
const sha = value => createHash('sha256').update(value).digest('hex');
function safe(relative, existing = true) {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative));
  const resolved = path.resolve(root, relative), local = path.relative(root, resolved);
  assert.ok(local && !local.startsWith('..') && !path.isAbsolute(local));
  if (existing) {
    assert.equal(fs.realpathSync(resolved), resolved);
    assert.equal(fs.lstatSync(resolved).isSymbolicLink(), false);
  }
  return resolved;
}
const read = relative => fs.readFileSync(safe(relative));
function inventory(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(safe(directory + (relative ? '/' + relative : '')), { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    const local = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...inventory(directory, local));
    else {
      assert.ok(entry.isFile());
      const bytes = read(directory + '/' + local);
      files.push({ path: local, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}
assert.equal(fs.existsSync(safe(parkedPath, false)), false);
assert.equal(fs.existsSync(safe(receipt, false)), false);
safe(path.posix.dirname(parkedPath));
const sourceAbsolute = safe(sourcePath), destinationAbsolute = safe(parkedPath, false);
assert.equal(sourceAbsolute, path.join(root, 'dist-pwa'));
assert.equal(path.dirname(destinationAbsolute), safe('.tmp/pwa-artifacts'));
const rawArtifact = read(sourcePath + '/artifact.json');
assert.equal(sha(rawArtifact), artifactSha256);
assert.equal(sha(read(existingArchive + '/artifact.json')), artifactSha256);
const artifact = JSON.parse(rawArtifact);
assert.equal(artifact.buildId, buildId);
assert.equal(artifact.sourceCommit, '1f9bae113129d00828dc1b0714e9002b1ff1f63f');
assert.equal(artifact.localQaAuthority, true);
assert.equal(artifact.releaseReady, false);
const before = inventory(sourcePath);
const archived = inventory(existingArchive);
assert.deepEqual(before, archived);
assert.equal(before.length, 364);
assert.equal(before.reduce((sum, file) => sum + file.bytes, 0), 41499116);
const expected = new Map(artifact.inventory.map(file => [file.path, file]));
for (const file of before) if (file.path !== 'artifact.json') assert.deepEqual(file, expected.get(file.path));
assert.equal(before.length, expected.size + 1);
// Both absolute targets, parent containment, every byte and absence of links
// have been checked before moving the directory in this same process.
fs.renameSync(sourceAbsolute, destinationAbsolute);
const after = inventory(parkedPath);
assert.deepEqual(after, before);
assert.equal(fs.existsSync(sourceAbsolute), false);
const result = { schemaVersion: 1, buildId, sourceCommit: artifact.sourceCommit, sourcePath,
  existingArchive, parkedPath, operation: 'same-workspace rename without overwrite',
  artifactSha256, files: after.length, bytes: after.reduce((sum, file) => sum + file.bytes, 0),
  exactBeforeAfterVerified: true, priorArchiveUnchanged: true, inventory: after,
  buildsRun: false, testsRun: false, stageAccepted: false, releaseReady: false };
fs.writeFileSync(safe(receipt, false), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ receipt, buildId, parkedPath, files: result.files, bytes: result.bytes,
  exactBeforeAfterVerified: true, buildsRun: false, testsRun: false }));
