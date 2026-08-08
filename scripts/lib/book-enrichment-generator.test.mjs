import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const generatorPath = path.join(
  projectRoot,
  "scripts",
  "build-book-enrichment-manifest.mjs"
);
const outputPaths = [
  "data/book-enrichment-manifest.json",
  "reports/book-corpus-classification.json",
  "reports/book-corpus-classification.md",
  "src/data/countries/generated/books.reviewed.json",
  "src/data/countries/generated/books.enrichment-actions.json",
].map((relativePath) => path.join(projectRoot, relativePath));

function digestOutputs() {
  return outputPaths.map((outputPath) =>
    createHash("sha256").update(readFileSync(outputPath)).digest("hex")
  );
}

function runCheck() {
  return spawnSync(
    process.execPath,
    [generatorPath, "--check", "--date=2026-08-08"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: process.env,
    }
  );
}

describe("book enrichment generator", () => {
  it("is idempotent when a reviewed promotion output is loaded again", () => {
    const before = digestOutputs();
    const first = runCheck();
    const afterFirst = digestOutputs();
    const second = runCheck();
    const afterSecond = digestOutputs();

    expect(first.status, first.stderr || first.stdout).toBe(0);
    expect(second.status, second.stderr || second.stdout).toBe(0);
    expect(afterFirst).toEqual(before);
    expect(afterSecond).toEqual(before);

    const manifest = JSON.parse(readFileSync(outputPaths[0], "utf8"));
    const reviewed = JSON.parse(readFileSync(outputPaths[3], "utf8"));
    const actions = JSON.parse(readFileSync(outputPaths[4], "utf8"));
    const promotedCount = Object.values(reviewed.works).flat().length;

    expect(reviewed.sourceManifestFingerprint).toBe(
      manifest.datasetFingerprint
    );
    expect(actions.sourceManifestFingerprint).toBe(
      manifest.datasetFingerprint
    );
    expect(actions.rejects).toEqual(manifest.safeActions.rejects);
    expect(actions.merges).toEqual(manifest.safeActions.merges);
    expect(promotedCount).toBe(manifest.summary.statuses.ready);
  }, 30_000);
});
