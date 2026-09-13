import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  headerLibraryAttestation,
  projectReviewedHeaderLibrary,
} from "./reviewed-header-library.mjs";

const sha256 = source => createHash("sha256").update(source).digest("hex");
const read = relativePath => readFileSync(relativePath, "utf8").replace(/\r\n?/gu, "\n");

describe("September 12 owner-approved header and library governance", () => {
  it("pins the new review independently of every existing historical attestation", () => {
    expect(sha256(JSON.stringify(headerLibraryAttestation))).toBe("dfa2034d0eea799a0fd6b4cd1594bbdb231ce3b208b4ab61213916adb4ea9d8a");
    expect(headerLibraryAttestation).toMatchObject({
      schemaVersion: 1,
      id: "HEADER-LIBRARY-OWNER-REFINEMENT-20260912",
      authorizedOn: "2026-09-12",
      baselineMainSha: "ba3336a05d83ff653984a43300bf4805e578b629",
    });
    expect([...new Set(headerLibraryAttestation.projections.map(delta => delta.path))])
      .toEqual(headerLibraryAttestation.allowedPaths);
    expect(Object.keys(headerLibraryAttestation.sourceBaselines))
      .toEqual(headerLibraryAttestation.allowedPaths);
    const ids = headerLibraryAttestation.projections.map(delta => delta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const relativePath of headerLibraryAttestation.allowedPaths) {
    it(`restores exact main bytes and rejects fragment drift in ${relativePath}`, () => {
      const source = read(relativePath);
      const projected = projectReviewedHeaderLibrary(relativePath, source);
      expect(sha256(projected)).toBe(headerLibraryAttestation.sourceBaselines[relativePath]);
      const unrelated = "\n/* This unreviewed byte sequence must remain protected. */\n";
      expect(projectReviewedHeaderLibrary(relativePath, source + unrelated))
        .toBe(projected + unrelated);
      expect(sha256(projected + unrelated)).not.toBe(headerLibraryAttestation.sourceBaselines[relativePath]);
      for (const delta of headerLibraryAttestation.projections.filter(entry => entry.path === relativePath)) {
        expect(delta.before).not.toBe(delta.after);
        expect(delta.before).not.toBe("");
        expect(delta.after).not.toBe("");
        expect(source.split(delta.after)).toHaveLength(2);
        for (const changed of [
          source.replace(delta.after, ""),
          source + delta.after,
          source.replace(delta.after, delta.after.replace(/\S/u, "?")),
        ]) {
          expect(() => projectReviewedHeaderLibrary(relativePath, changed))
            .toThrow("Missing or duplicate reviewed header/library delta");
        }
      }
    });
  }

  it("does not project book records, archive publication code or the main CI workflow", () => {
    for (const relativePath of [
      "src/data/bookArchive.ts",
      "src/data/countries/generated/books.reviewed.json",
      "data/book-canon-source-registry.json",
      "scripts/sync-literary-archive.mjs",
      ".github/workflows/quality.yml",
      ".github/workflows/reconcile-production-database.yml",
    ]) {
      expect(headerLibraryAttestation.allowedPaths).not.toContain(relativePath);
      expect(projectReviewedHeaderLibrary(relativePath, "protected content\n"))
        .toBe("protected content\n");
    }
  });
});
