import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, repositoryFile, snapshotReference, verifyEvidenceRecord } from "./evidence.mjs";

const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(tmpdir())) throw new Error("Unsafe fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await mkdtemp(path.join(path.resolve(tmpdir()), "v12-evidence-")); roots.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "V12 test"]);
  git(root, ["config", "user.email", "v12-test@example.invalid"]);
  git(root, ["config", "core.autocrlf", "true"]);
  await writeFile(path.join(root, "source.ts"), "export const value = 1;\n");
  await writeFile(path.join(root, "check.log"), "1 test passed\n");
  git(root, ["add", "--", "source.ts", "check.log"]);
  git(root, ["-c", "core.hooksPath=", "commit", "-qm", "Fixture source and observed evidence"]);
  const sourceCommit = git(root, ["rev-parse", "HEAD"]).trim();
  const record = { version: "12.0", sourceCommit, criterionIds: ["S01.traceability"], requirementIds: ["BIL-001"],
    sourceFiles: [await snapshotReference(root, sourceCommit, "source.ts")],
    artifacts: [await snapshotReference(root, sourceCommit, "check.log")],
    checks: [{ command: "test runner", exitCode: 0, log: "check.log" }],
  };
  return { root, record };
}
describe("evidence identity and freshness", () => {
  it("accepts exact source/artifact hashes and equivalent CRLF text", async () => {
    const { root, record } = await fixture();
    await writeFile(path.join(root, "check.log"), "1 test passed\r\n");
    expect(await verifyEvidenceRecord(root, record, { criterionId: "S01.traceability", currentInputs: true })).toMatchObject({ pass: true, staleInputs: [] });
  });
  it("rejects artifacts rewritten after a successful run", async () => {
    const { root, record } = await fixture();
    await writeFile(path.join(root, "check.log"), "failure hidden by fabricated report\n");
    expect((await verifyEvidenceRecord(root, record)).pass).toBe(false);
  });
  it("exposes historical stale inputs and rejects them for current PASSED claims", async () => {
    const { root, record } = await fixture();
    await writeFile(path.join(root, "source.ts"), "export const value = 2;\n");
    expect(await verifyEvidenceRecord(root, record)).toMatchObject({ pass: true, staleInputs: ["source.ts"] });
    expect((await verifyEvidenceRecord(root, record, { currentInputs: true })).pass).toBe(false);
  });
  it("rejects unrelated criterion/requirement evidence and missing successful checks", async () => {
    const { root, record } = await fixture();
    expect((await verifyEvidenceRecord(root, record, { criterionId: "S02.other", requirementId: "BIL-002" })).pass).toBe(false);
    record.checks[0].exitCode = 1;
    expect((await verifyEvidenceRecord(root, record)).pass).toBe(false);
  });
  it("rejects edited hashes, unknown source commits and incomplete records", async () => {
    const { root, record } = await fixture();
    record.artifacts[0].sha256 = "0".repeat(64);
    expect((await verifyEvidenceRecord(root, record)).pass).toBe(false);
    record.sourceCommit = "0".repeat(40);
    expect((await verifyEvidenceRecord(root, record)).pass).toBe(false);
    expect((await verifyEvidenceRecord(root, { version: "12.0", sourceCommit: "a".repeat(40) })).pass).toBe(false);
  });
  it("rejects traversal and directory junctions escaping the repository", async () => {
    const { root } = await fixture();
    await expect(repositoryFile(root, "../secret")).rejects.toThrow();
    const outside = await mkdtemp(path.join(path.resolve(tmpdir()), "v12-evidence-outside-")); roots.push(outside);
    await writeFile(path.join(outside, "secret.txt"), "outside test data");
    await mkdir(path.join(root, "evidence"));
    await symlink(outside, path.join(root, "evidence", "linked"), process.platform === "win32" ? "junction" : "dir");
    await expect(repositoryFile(root, "evidence/linked/secret.txt")).rejects.toThrow("escapes repository");
    expect(await readFile(path.join(outside, "secret.txt"), "utf8")).toBe("outside test data");
  });
  it("preserves historical source identity after a later extraction removes the old path", async () => {
    const { root, record } = await fixture();
    await rm(path.join(root, "source.ts"));
    expect(await verifyEvidenceRecord(root, record)).toMatchObject({ pass: true, staleInputs: ["source.ts"] });
    expect((await verifyEvidenceRecord(root, record, { currentInputs: true })).pass).toBe(false);
  });
  it("rejects substring scope matches and malformed reference collections", async () => {
    const { root, record } = await fixture();
    record.criterionIds = "prefix-S01.traceability-suffix";
    record.requirementIds = "prefix-BIL-001-suffix";
    expect((await verifyEvidenceRecord(root, record, { criterionId: "S01.traceability", requirementId: "BIL-001" })).pass).toBe(false);
    record.criterionIds = ["S01.traceability"]; record.requirementIds = ["BIL-001"];
    record.sourceFiles = { length: 1 };
    expect((await verifyEvidenceRecord(root, record)).pass).toBe(false);
  });
});
