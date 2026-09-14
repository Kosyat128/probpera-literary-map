import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = fs.realpathSync(process.cwd());
assert.equal(root.replaceAll("\\", "/"), "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
const nativeRoot = ".tmp/native-builds";
const targetBytes = 500 * 1024 * 1024;
const maxCandidates = 12;
const reportPath = ".tmp/native-runtime-duplicate-audit-20260914-a1.json";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const ordinal = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function contained(relative, allowedRoot = ".tmp") {
  const absolute = path.resolve(root, relative);
  const inside = path.relative(path.resolve(root, allowedRoot), absolute);
  assert.ok(!inside.startsWith("..") && !path.isAbsolute(inside), "Uncontained path: " + relative);
  const local = path.relative(root, absolute);
  assert.ok(local && !local.startsWith("..") && !path.isAbsolute(local));
  let current = root;
  for (const part of local.split(path.sep)) {
    current = path.join(current, part);
    assert.equal(fs.lstatSync(current).isSymbolicLink(), false, "Linked path: " + relative);
    assert.equal(fs.realpathSync(current), current, "Redirected path: " + relative);
  }
  return absolute;
}
function metadata(relative, allowedRoot) {
  const absolute = contained(relative, allowedRoot);
  assert.ok(fs.lstatSync(absolute).isDirectory(), "Not a directory");
  const filename = contained(relative + "/artifact.json", allowedRoot);
  assert.ok(fs.lstatSync(filename).isFile(), "Not a regular artifact");
  const bytes = fs.readFileSync(filename);
  const value = JSON.parse(bytes.toString("utf8"));
  assert.match(value.buildId, /^[a-f0-9]{64}$/u);
  return { path: relative, absolutePath: absolute, artifactSha256: sha(bytes), buildId: value.buildId, sourceCommit: value.sourceCommit };
}
const retainedMetadata = [], retainedSkipped = [];
function findRetained(relative = nativeRoot, depth = 0) {
  assert.ok(depth <= 5, "Unexpected native archive directory depth");
  for (const entry of fs.readdirSync(contained(relative, nativeRoot), { withFileTypes: true }).sort((a, b) => ordinal(a.name, b.name))) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const child = relative + "/" + entry.name;
    if (entry.isSymbolicLink()) { retainedSkipped.push({ path: child, reason: "linked directory" }); continue; }
    try {
      if (entry.name === "runtime") retainedMetadata.push(metadata(child, nativeRoot));
      else if (depth < 5) findRetained(child, depth + 1);
    } catch (error) { retainedSkipped.push({ path: child, reason: error.message }); }
  }
}
findRetained();
const byIdentity = new Map();
for (const record of retainedMetadata) {
  const key = record.artifactSha256 + ":" + record.buildId;
  const matches = byIdentity.get(key) || [];
  matches.push(record);
  byIdentity.set(key, matches);
}
function fullTree(relative, allowedRoot) {
  const start = contained(relative, allowedRoot), tree = [], fileStates = [];
  function walk(directory, prefix = "") {
    const before = fs.statSync(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => ordinal(a.name, b.name))) {
      const local = prefix + entry.name;
      const filename = contained(relative + "/" + local, allowedRoot);
      const stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
        tree.push({ path: local, kind: "directory" });
        walk(filename, local + "/");
      } else {
        assert.ok(stat.isFile(), "Non-file runtime entry " + local);
        const bytes = fs.readFileSync(filename), after = fs.statSync(filename);
        assert.equal(bytes.length, stat.size);
        assert.deepEqual([after.dev, after.ino, after.size, after.mtimeMs], [stat.dev, stat.ino, stat.size, stat.mtimeMs], "File changed while hashing");
        tree.push({ path: local, kind: "file", bytes: bytes.length, sha256: sha(bytes) });
        fileStates.push({ path: filename, dev: after.dev, ino: after.ino, size: after.size, mtimeMs: after.mtimeMs });
      }
    }
    const after = fs.statSync(directory);
    assert.deepEqual([after.dev, after.ino, after.mtimeMs], [before.dev, before.ino, before.mtimeMs], "Directory changed while hashing");
  }
  walk(start);
  tree.sort((a, b) => ordinal(a.path, b.path));
  const files = tree.filter(item => item.kind === "file");
  const serialized = JSON.stringify(tree);
  return { serialized, treeSha256: sha(serialized), files: files.length, directories: tree.length - files.length,
    bytes: files.reduce((total, item) => total + item.bytes, 0), fileStates };
}
function unchanged(tree) {
  for (const entry of tree.fileStates) {
    const current = fs.lstatSync(entry.path);
    assert.ok(current.isFile() && !current.isSymbolicLink());
    assert.deepEqual([current.dev, current.ino, current.size, current.mtimeMs], [entry.dev, entry.ino, entry.size, entry.mtimeMs], "Previously hashed file changed");
  }
}
const selected = fs.readdirSync(contained(".tmp"), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^native-previous-[A-Za-z0-9-]+$/u.test(entry.name))
  .sort((a, b) => ordinal(b.name, a.name)).slice(0, maxCandidates).map(entry => ".tmp/" + entry.name);
const retainedTrees = new Map(), redundant = [], ignored = [];
let reclaimableBytes = 0, examined = 0;
for (const candidate of selected) {
  if (reclaimableBytes >= targetBytes) break;
  examined += 1;
  try {
    const identity = metadata(candidate, candidate);
    const matches = byIdentity.get(identity.artifactSha256 + ":" + identity.buildId) || [];
    if (!matches.length) { ignored.push({ path: candidate, reason: "No retained runtime with identical artifact SHA256 and build ID", artifactSha256: identity.artifactSha256, buildId: identity.buildId }); continue; }
    const candidateTree = fullTree(candidate, candidate);
    let canonical = null, retainedTree = null;
    for (const match of matches) {
      try {
        let tree = retainedTrees.get(match.path);
        if (!tree) { tree = fullTree(match.path, nativeRoot); retainedTrees.set(match.path, tree); }
        unchanged(tree);
        if (candidateTree.serialized === tree.serialized) { canonical = match; retainedTree = tree; break; }
      } catch (error) { retainedSkipped.push({ path: match.path, reason: error.message }); }
    }
    if (!canonical) { ignored.push({ path: candidate, reason: "Full paths/directories/bytes/SHA256 tree differs or retained tree could not be validated", artifactSha256: identity.artifactSha256, buildId: identity.buildId }); continue; }
    unchanged(candidateTree);
    assert.equal(metadata(candidate, candidate).artifactSha256, identity.artifactSha256);
    assert.equal(metadata(canonical.path, nativeRoot).artifactSha256, identity.artifactSha256);
    redundant.push({
      redundantPath: candidate, redundantAbsolutePath: identity.absolutePath,
      retainedPath: canonical.path, retainedAbsolutePath: canonical.absolutePath,
      buildId: identity.buildId, sourceCommit: identity.sourceCommit, artifactSha256: identity.artifactSha256,
      fullTreeSha256: candidateTree.treeSha256, files: candidateTree.files, directories: candidateTree.directories,
      bytes: candidateTree.bytes, retainedBytes: retainedTree.bytes, containedRealPathsVerified: true,
      noSymlinksVerified: true, exactArtifactIdentity: true, fullTreePathBytesAndSha256Equal: true,
      disposition: "redundant at audit time; root decides any deletion and retains canonical path"
    });
    reclaimableBytes += candidateTree.bytes;
    console.log(JSON.stringify({ examined, redundant: redundant.length, reclaimableBytes, candidate }));
  } catch (error) { ignored.push({ path: candidate, reason: error.message }); }
}
const report = {
  schemaVersion: 1, status: "READ_ONLY_DUPLICATE_RUNTIME_AUDIT", checkedAt: new Date().toISOString(),
  candidateScope: ".tmp/native-previous-*", retainedScope: ".tmp/native-builds/**/runtime",
  maxCandidateDirectories: maxCandidates, selectedCandidateDirectories: selected.length, examinedCandidateDirectories: examined,
  targetBytes, reclaimableBytes, reclaimableMiB: Number((reclaimableBytes / 1024 / 1024).toFixed(2)),
  targetReached: reclaimableBytes >= targetBytes, retainedMetadataRecords: retainedMetadata.length,
  retainedFullTreesHashed: retainedTrees.size, redundant, ignored, retainedSkipped,
  treeDigestEncoding: "SHA256 of UTF-8 JSON.stringify of all directory {path,kind} and file {path,kind,bytes,sha256} records sorted by ordinal relative path",
  deletionsPerformed: false, movesPerformed: false, userDataTouched: false, sourceOrEvidenceModified: false,
  boundary: "Only generated previous runtime trees with exact retained immutable counterparts are listed. Unmatched/unique/linked/mutating trees remain untouched. This report is not deletion authorization; revalidate paths and retained identity if state changed after this audit."
};
const absoluteReport = path.resolve(root, reportPath);
assert.equal(path.dirname(absoluteReport), contained(".tmp"));
fs.writeFileSync(absoluteReport, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ reportPath, examined, redundant: redundant.length, reclaimableBytes, reclaimableMiB: report.reclaimableMiB, targetReached: report.targetReached, deletionsPerformed: false }));
