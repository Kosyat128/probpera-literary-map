import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  projectReviewedReferenceRelease, referenceReleaseAttestation,
  reviewedReferenceReleaseSourceSha256,
} from "./reviewed-reference-release.mjs";
import {
  projectPublishedR49nPackage, projectReviewedR49nPackage, r49nPackageAttestation,
} from "./reviewed-r49n-package.mjs";

const read = path => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
const sha = text => createHash("sha256").update(text).digest("hex");
const protectedPaths = [
  ".github/workflows/dispatch-premium-database-reconciliation.yml",
  ".github/workflows/reconcile-production-database.yml",
  "scripts/database/build-production-migration-plan.mjs",
  "scripts/sync-literary-archive.mjs",
];

describe("September 14 additive canonical-reference release governance", () => {
  it("pins a separate maintenance review against the published main boundary", () => {
    expect(sha(JSON.stringify(referenceReleaseAttestation))).toBe("3957434c003c6be362b8dc30559490e1c3530aaaa81aaa4e47eb18724e6aa379");
    expect(referenceReleaseAttestation).toMatchObject({
      id: "LIBRARY-REFERENCE-RELEASE-20260914",
      baselineSourceCommitSha: "3cf9060888cb95cfe900cf695bf2666f4c93590a",
      reviewStatus: "source-reviewed",
    });
    expect(referenceReleaseAttestation.allowedProjectionPaths).toEqual(protectedPaths);
    expect(Object.keys(referenceReleaseAttestation.sourceBaselines).sort()).toEqual(protectedPaths);
    expect(Object.keys(referenceReleaseAttestation.reviewedSourceSha256).sort()).toEqual(protectedPaths);
    expect(new Set(referenceReleaseAttestation.projections.map(delta => delta.id)).size)
      .toBe(referenceReleaseAttestation.projections.length);
    for (const delta of referenceReleaseAttestation.projections) {
      expect(protectedPaths).toContain(delta.path);
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after.length).toBeGreaterThan(0);
    }
  });

  it("preserves the published R49N packet and all 37 historical SQL pins", () => {
    expect(sha(JSON.stringify(r49nPackageAttestation)))
      .toBe("932f3b3d81d4f3db0fc901f9b31bf3719490afffd0b11549f87f094611f398e8");
    for (const file of referenceReleaseAttestation.historicalArtifacts)
      expect(sha(read(file.path))).toBe(file.sha256Lf);
    expect(referenceReleaseAttestation.historicalMigrations).toHaveLength(37);
    for (const migration of referenceReleaseAttestation.historicalMigrations)
      expect(sha(read(migration.path))).toBe(migration.sha256Lf);
  });

  it.each(protectedPaths)("restores exact published bytes and keeps prior locks active for %s", path => {
    const source = read(path), previous = projectReviewedReferenceRelease(path, source);
    expect(sha(source)).toBe(referenceReleaseAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(referenceReleaseAttestation.sourceBaselines[path]);
    expect(projectReviewedReferenceRelease(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    expect(projectReviewedR49nPackage(path, source)).toBe(projectPublishedR49nPackage(path, previous));
    const priorSha = r49nPackageAttestation.sourceBaselines[path] ?? referenceReleaseAttestation.sourceBaselines[path];
    expect(sha(projectReviewedR49nPackage(path, source))).toBe(priorSha);
    const unrelated = "\n/* Unreviewed bytes must remain protected. */\n";
    expect(projectReviewedReferenceRelease(path, source + unrelated)).toBe(previous + unrelated);
    expect(reviewedReferenceReleaseSourceSha256(previous + unrelated))
      .not.toBe(referenceReleaseAttestation.sourceBaselines[path]);
    expect(sha(projectReviewedR49nPackage(path, source + unrelated)))
      .not.toBe(priorSha);
    const deltas = referenceReleaseAttestation.projections.filter(delta => delta.path === path);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [
        source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?")),
      ]) {
        expect(() => projectReviewedReferenceRelease(path, changed))
          .toThrow("Missing or duplicate reviewed reference-release delta");
        expect(() => projectReviewedR49nPackage(path, changed))
          .toThrow("Missing or duplicate reviewed reference-release delta");
      }
    }
  });

  it("does not hide changes to other SQL, data or UI sources", () => {
    for (const path of [
      "supabase/migrations/20260912_literary_work_evidence_v2_registry_rotation.sql",
      "src/data/bookArchive.ts", "src/components/HeaderArticlesMenu.tsx",
      "data/book-canon-source-registry.json", "unreviewed-file.mjs",
    ]) {
      const text = "Unreviewed source\n";
      expect(projectReviewedReferenceRelease(path, text)).toBe(text);
      expect(projectReviewedReferenceRelease(path, text + "changed\n")).toBe(text + "changed\n");
    }
  });

  it("binds the exact reviewed implementation and records no production completion claim", () => {
    const entry = referenceReleaseAttestation.reviewedReport;
    const text = read(entry.path), report = JSON.parse(text);
    expect(sha(text)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({
      baselineSourceCommitSha: "3cf9060888cb95cfe900cf695bf2666f4c93590a",
      humanReview: false, productionApplied: false,
      priorMigrationPinsChanged: false, existingEditorialRowsChanged: false,
      evidenceApprovalGranted: false, unusedReferencesInserted: false,
      reservedWriterProofsPreserved: true, wholeReleaseRollbackPreserved: true,
    });
    expect(report.files.length).toBeGreaterThan(3);
    for (const file of report.files) expect(sha(read(file.path))).toBe(file.sha256Lf);
  });
});
