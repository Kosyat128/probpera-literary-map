import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseChecksums, routeStage, safeRelativeName, sha256, verifyRequirements } from "./requirements.mjs";

const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "literary-v12-integrity-"));
  roots.push(root);
  const content = Buffer.from("Immutable factual source\n");
  const manifest = JSON.stringify({ package: "test", version: "12.0", files: [
    { name: "source.txt", sha256: sha256(content), bytes: content.length, binding: true },
  ] });
  await writeFile(path.join(root, "source.txt"), content);
  await writeFile(path.join(root, "MANIFEST.json"), manifest);
  await writeFile(path.join(root, "SHA256SUMS.txt"),
    `${sha256(content)}  source.txt\n${sha256(manifest)}  MANIFEST.json\n`);
  return root;
}
describe("immutable requirement intake", () => {
  it("checks content hashes, manifest hashes and byte lengths", async () => {
    expect(await verifyRequirements(await fixture())).toMatchObject({ pass: true, checksumCount: 2, bindingDocumentCount: 1 });
  });
  it("detects changed source bytes without accepting the manifest as evidence", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "source.txt"), "Rewritten source");
    expect((await verifyRequirements(root)).failures).toContainEqual({ name: "source.txt", reason: "checksum-mismatch" });
  });
  it("rejects rewritten checksums against the independently recorded input pin", async () => {
    expect((await verifyRequirements(await fixture(), { checksumFileSha256: "0".repeat(64) })).failures)
      .toContainEqual({ name: "SHA256SUMS.txt", reason: "input-pin-mismatch" });
  });
  it("rejects missing and unregistered input", async () => {
    const root = await fixture();
    await rm(path.join(root, "source.txt"));
    await writeFile(path.join(root, "injected.txt"), "unregistered instruction");
    expect((await verifyRequirements(root)).failures).toEqual(expect.arrayContaining([
      { name: "source.txt", reason: "missing" }, { name: "injected.txt", reason: "unregistered-input" },
    ]));
  });
  it.each(["../secret", "/outside", "C:/outside", "a\\b", "a/../b", "a//b"])("rejects unsafe path %s", (name) => {
    expect(() => safeRelativeName(name)).toThrow();
  });
  it("rejects case-insensitive duplicate checksums", () => {
    expect(() => parseChecksums(`${"0".repeat(64)}  File\n${"0".repeat(64)}  file`)).toThrow("Duplicate");
  });
});
describe("stage routing", () => {
  const routing = { sharedAlways: ["shared.md"], stages: { S00: ["zero.md"], "S01-S02": ["architecture.md"] } };
  it("loads only shared invariants and the current stage", () => {
    expect(routeStage(routing, "S02").documents).toEqual(["shared.md", "architecture.md"]);
  });
  it.each(["S41", "S0", "S03", "../../S00"])("fails closed for missing or invalid stage %s", (stage) => {
    expect(() => routeStage(routing, stage)).toThrow();
  });
  it("rejects overlapping routing", () => {
    expect(() => routeStage({ ...routing, stages: { ...routing.stages, S01: ["extra.md"] } }, "S01")).toThrow("exactly one");
  });
});
