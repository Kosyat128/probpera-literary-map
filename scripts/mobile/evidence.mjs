import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { safeRelativeName, sha256 } from "./requirements.mjs";

const fullSha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
export function git(root, args, bytes = false) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: bytes ? undefined : "utf8", maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
}
export async function repositoryFile(root, relativePath) {
  safeRelativeName(relativePath);
  const rootPath = await realpath(root);
  const filename = path.resolve(rootPath, relativePath);
  const resolved = await realpath(filename);
  const relative = path.relative(rootPath, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`File escapes repository: ${relativePath}`);
  }
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular repository file: ${relativePath}`);
  return { filename, bytes: await readFile(filename) };
}
export async function snapshotReference(root, commit, relativePath) {
  if (!fullSha(commit)) throw new Error("Evidence requires a full Git source SHA");
  safeRelativeName(relativePath);
  const entry = git(root, ["ls-tree", "-z", commit, "--", relativePath]);
  if (!/^(100644|100755) blob [a-f0-9]{40}\t/.test(entry)) throw new Error("Not a regular Git file at source commit");
  const bytes = git(root, ["show", `${commit}:${relativePath}`], true);
  return { path: relativePath, gitBlob: git(root, ["rev-parse", `${commit}:${relativePath}`]).trim(), sha256: sha256(bytes) };
}
export async function verifyEvidenceRecord(root, record, { criterionId, requirementId, sourceCommit, currentInputs = false } = {}) {
  const errors = [], staleInputs = [];
  const fail = message => errors.push(message);
  if (record?.version !== "12.0" || !fullSha(record.sourceCommit)) return { pass: false, errors: ["Invalid evidence version/source commit"], staleInputs };
  const identities = value => Array.isArray(value) && value.every(id => typeof id === "string" && id.length > 0) && new Set(value).size === value.length;
  const references = value => Array.isArray(value) && value.length > 0 && value.every(item => item &&
    typeof item.path === "string" && typeof item.gitBlob === "string" && typeof item.sha256 === "string");
  if (!identities(record.criterionIds) || !identities(record.requirementIds) ||
      !references(record.sourceFiles) || !references(record.artifacts) || !Array.isArray(record.checks) || !record.checks.length ||
      record.checks.some(check => !check || typeof check.command !== "string" || typeof check.log !== "string" || typeof check.exitCode !== "number")) {
    return { pass: false, errors: ["Malformed evidence identities/references/checks"], staleInputs };
  }
  if (sourceCommit && record.sourceCommit !== sourceCommit) fail("Evidence source commit does not match criterion/requirement");
  if (criterionId && !record.criterionIds?.includes(criterionId)) fail("Evidence does not cover this criterion");
  if (requirementId && !record.requirementIds?.includes(requirementId)) fail("Evidence does not cover this requirement");
  if (!record.sourceFiles?.length || !record.artifacts?.length || !record.checks?.length) fail("Evidence needs source files, artifacts and checks");
  try { git(root, ["merge-base", "--is-ancestor", record.sourceCommit, "HEAD"]); }
  catch { fail("Evidence source is not an ancestor of this checkout"); }
  const artifactPaths = new Set();
  for (const [kind, references] of [["source", record.sourceFiles], ["artifact", record.artifacts]]) {
    const seen = new Set();
    for (const reference of references ?? []) {
      try {
        if (seen.has(reference.path)) throw new Error("Duplicate reference");
        seen.add(reference.path);
        if (!fullSha(reference.gitBlob) || !/^[a-f0-9]{64}$/.test(reference.sha256)) throw new Error("Invalid artifact hash");
        const snapshot = await snapshotReference(root, record.sourceCommit, reference.path);
        if (snapshot.gitBlob !== reference.gitBlob || snapshot.sha256 !== reference.sha256) throw new Error("Source-commit artifact identity mismatch");
        let filename;
        try { ({ filename } = await repositoryFile(root, reference.path)); }
        catch (error) {
          if (error.code === "ENOENT" && kind === "source" && !currentInputs) { staleInputs.push(reference.path); continue; }
          throw error;
        }
        // Git's clean conversion respects .gitattributes (including -text for
        // the immutable archive), avoiding false staleness from Windows CRLF.
        const currentBlob = git(root, ["hash-object", `--path=${reference.path}`, filename]).trim();
        if (currentBlob !== reference.gitBlob) {
          if (kind === "artifact" || currentInputs) throw new Error("Evidence/input changed since verification");
          staleInputs.push(reference.path);
        }
        if (kind === "artifact") artifactPaths.add(reference.path);
      } catch (error) { fail(`${kind}/${reference?.path}: ${error.message}`); }
    }
  }
  for (const check of record.checks ?? []) {
    if (!check.command?.trim() || check.exitCode !== 0 || !artifactPaths.has(check.log)) fail("Missing successful command and hashed log");
  }
  return { pass: errors.length === 0, errors, staleInputs };
}
