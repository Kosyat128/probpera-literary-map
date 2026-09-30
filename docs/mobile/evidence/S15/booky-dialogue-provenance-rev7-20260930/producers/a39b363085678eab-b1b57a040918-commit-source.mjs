import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const base = path.dirname(fileURLToPath(import.meta.url)), out = path.join(base, 'actual-a1');
const sha = b => createHash('sha256').update(b).digest('hex');
const ref = p => ({ path: p.replaceAll('\\', '/'), sha256: sha(fs.readFileSync(p)) });
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', 'safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work', ...args], { cwd: root, env: { ...process.env, GIT_CONFIG_PARAMETERS: "'core.autocrlf=true'" }, maxBuffer: 64 * 1024 * 1024 });
const gt = (...a) => git(...a).toString('utf8').trim();
const entryPath = path.join(out, 'entry.json'), entry = read(entryPath), checksPath = path.join(out, 'checks-result.json'), checks = read(checksPath);
assert.equal(ref(checksPath).sha256, 'e300c3933375f67a6ef88ff70f459d718c2e02bcee9891cf501c524da47b1e27');
assert.equal(checks.pass, true); assert.equal(checks.sourceInputsUnchanged, true);
assert.deepEqual(checks.entry, ref(entryPath));
assert.equal(ref(entry.sourceManifest.path).sha256, entry.sourceManifest.sha256);
const manifest = read(entry.sourceManifest.path), changed = entry.changedPaths;
const stable = () => { for (const f of manifest.files) assert.equal(ref(path.join(root, f.path)).sha256, f.sha256, f.path); };
stable();
assert.equal(gt('rev-parse', 'HEAD'), entry.checkpoint);
assert.equal(gt('diff', '--cached', '--name-only'), '');
assert.deepEqual(gt('diff', '--name-only').split('\n').sort(), changed);
assert.equal(gt('ls-files', '--others', '--exclude-standard'), '');
for (const rr of checks.results) { assert.equal(ref(rr.path).sha256, rr.sha256); assert.equal(read(rr.path).pass, true); }
git('add', '--', ...changed);
assert.deepEqual(gt('diff', '--cached', '--name-only').split('\n').sort(), changed);
const commitOutput = gt('commit', '-m', 'Refresh Booky contextual and support draft provenance');
const sourceCommit = gt('rev-parse', 'HEAD');
assert.equal(gt('rev-parse', sourceCommit + '^'), entry.checkpoint);
const blobs = changed.map(p => { const raw = fs.readFileSync(path.join(root, p)), blob = git('cat-file', 'blob', sourceCommit + ':' + p);
  assert.equal(raw.toString('utf8').replaceAll('\r\n', '\n'), blob.toString('utf8').replaceAll('\r\n', '\n'));
  return { path: p, workingSha256: sha(raw), gitBlobSha256: sha(blob), onlyLineEndingNormalization: !raw.equals(blob) }; });
stable(); assert.equal(gt('status', '--porcelain'), '');
const result = { schemaVersion: 1, pass: true, sourceCommit, predecessorDocsCommit: entry.checkpoint, runtimeSourceCommit: entry.runtimeSourceCommit,
  changedPaths: changed, sourceManifest: entry.sourceManifest, sourceInputCount: 1665, protectedInputCount: 1659, entry: ref(entryPath), checksResult: ref(checksPath),
  sourceInputsUnchanged: true, worktreeClean: true, metadataOnly: true, runtimeUnchanged: true, testsRerun: false, buildsRun: false,
  blobs, commitOutput, producer: ref(fileURLToPath(import.meta.url)), stageAccepted: false, releaseReady: false };
const p = path.join(out, 'actual-source-commit.json'); fs.writeFileSync(p, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sourceCommit, result: ref(p) }));
