import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectReviewedDraftStorage } from "./reviewed-draft-storage.mjs";
import {
  nativeArchiveTransportAttestation,
  projectPublishedNativeArchiveTransport as projectReviewedNativeArchiveTransport,
} from "./reviewed-native-archive-transport.mjs";
import { projectReviewedHeaderShowcase, headerShowcaseAttestation } from "./reviewed-header-showcase.mjs";
import { projectReviewedReferenceRelease, referenceReleaseAttestation } from "./reviewed-reference-release.mjs";
import { projectPublishedR49nPackage, r49nPackageAttestation } from "./reviewed-r49n-package.mjs";

const read = path => projectReviewedDraftStorage(path, readFileSync(path, "utf8"));
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = [
  ".github/workflows/reconcile-production-database.yml",
  "scripts/database/literary-work-evidence-v2-migration.test.mjs",
  "scripts/database/production-migration-plan.test.mjs",
  "scripts/database/supabase-database-safety.sh",
  "scripts/lib/reviewed-header-showcase.test.mjs",
  "scripts/lib/reviewed-r49n-package.test.mjs",
  "scripts/lib/reviewed-reference-release.test.mjs",
  "scripts/lib/stage5-content-data-lock.test.mjs",
  "scripts/sync-literary-archive.mjs",
  "src/data/bookCmsWellsPriority20260913.test.ts",
  "src/data/bookR49nPackageReviewed20260912.test.ts",
  "src/data/countries/bookR49nDickensReviewed20260912.test.ts",
  "src/data/countries/bookR49nRetainedDrafts20260912.test.ts",
  "src/data/userSuppliedBookCoversBatch20260820.test.ts",
];

describe("September 14 native archive release and CMS test compatibility governance", () => {
  it("pins a separate exact transport repair against main and the reviewed UI adapter boundary", () => {
    expect(sha(JSON.stringify(nativeArchiveTransportAttestation))).toBe("cb78cfa458794e0aaf68bfaefd54ef012f9ce7d3a41edb98729b44db1854413c");
    expect(nativeArchiveTransportAttestation).toMatchObject({
      id: "LIBRARY-NATIVE-TRANSPORT-20260914",
      baselineSourceCommitSha: "d6c7849ccc5285e17c6da9ef147fecc9fdd0f000",
      reviewStatus: "source-reviewed",
    });
    expect(nativeArchiveTransportAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(nativeArchiveTransportAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(nativeArchiveTransportAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(nativeArchiveTransportAttestation.projections.map(delta => delta.id)).size)
      .toBe(nativeArchiveTransportAttestation.projections.length);
    for (const delta of nativeArchiveTransportAttestation.projections) {
      expect(paths).toContain(delta.path);
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after).not.toBe("");
    }
  });

  it.each(paths)("restores prior bytes and rejects missing, duplicate or changed fragments in %s", path => {
    const source = read(path), previous = projectReviewedNativeArchiveTransport(path, source);
    expect(sha(source)).toBe(nativeArchiveTransportAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(nativeArchiveTransportAttestation.sourceBaselines[path]);
    expect(projectReviewedNativeArchiveTransport(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    const unrelated = "\n/* Unreviewed bytes remain visible to the original locks. */\n";
    expect(projectReviewedNativeArchiveTransport(path, source + unrelated)).toBe(previous + unrelated);
    expect(sha(previous + unrelated)).not.toBe(nativeArchiveTransportAttestation.sourceBaselines[path]);
    const deltas = nativeArchiveTransportAttestation.projections.filter(delta => delta.path === path);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedNativeArchiveTransport(path, changed))
          .toThrow("Missing or duplicate reviewed native-transport delta");
      }
    }
  });

  it("keeps the published reference, R49 and reviewed showcase boundaries exact", () => {
    for (const path of [".github/workflows/reconcile-production-database.yml", "scripts/sync-literary-archive.mjs"]) {
      const previous = projectReviewedNativeArchiveTransport(path, read(path));
      expect(sha(previous)).toBe(referenceReleaseAttestation.reviewedSourceSha256[path]);
      const r49 = projectReviewedReferenceRelease(path, previous);
      expect(sha(r49)).toBe(referenceReleaseAttestation.sourceBaselines[path]);
      expect(sha(projectPublishedR49nPackage(path, r49))).toBe(r49nPackageAttestation.sourceBaselines[path]);
    }
    const path = "scripts/lib/reviewed-r49n-package.test.mjs";
    const showcase = projectReviewedNativeArchiveTransport(path, read(path));
    expect(sha(showcase)).toBe(headerShowcaseAttestation.reviewedSourceSha256[path]);
    expect(sha(projectReviewedHeaderShowcase(path, showcase)))
      .toBe(headerShowcaseAttestation.sourceBaselines[path]);
    const reference = JSON.parse(read(referenceReleaseAttestation.reviewedReport.path));
    const test = "scripts/database/production-migration-plan.test.mjs";
    expect(sha(projectReviewedNativeArchiveTransport(test, read(test))))
      .toBe(reference.files.find(file => file.path === test).sha256Lf);
  });

  it("preserves every historical packet, all 38 migration files and the atomic release core", () => {
    expect(nativeArchiveTransportAttestation.historicalMigrations).toHaveLength(38);
    for (const file of [...nativeArchiveTransportAttestation.historicalArtifacts,
      ...nativeArchiveTransportAttestation.historicalMigrations,
      ...nativeArchiveTransportAttestation.unchangedCoreFiles]) {
      expect(sha(read(file.path))).toBe(file.sha256Lf);
    }
  });

  it("does not exempt database functions, editorial data, image sources or other paths", () => {
    for (const path of ["scripts/lib/literary-archive-atomic-release.mjs", "src/index.css",
      "src/data/bookArchive.ts", "data/book-canon-source-registry.json",
      "supabase/migrations/20260914_literary_archive_editorial_references.sql", "unreviewed.sh"]) {
      const text = "Unreviewed content\n";
      expect(projectReviewedNativeArchiveTransport(path, text)).toBe(text);
      expect(projectReviewedNativeArchiveTransport(path, text + "changed\n")).toBe(text + "changed\n");
    }
  });

  it("binds the actual transport implementation without claiming a production commit", () => {
    const entry = nativeArchiveTransportAttestation.reviewedReport;
    const text = read(entry.path), report = JSON.parse(text);
    expect(sha(text)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({
      humanReview: false, productionApplied: false, historicalPinsChanged: false,
      coreCommitFunctionChanged: false, migrationFilesChanged: false,
      globalOrRoleTimeoutsChanged: false, humanIdentityImpersonated: false,
      databaseRowsDirectlyModifiedByTransport: false, broadSourceExclusionsAdded: false,
    });
    for (const file of report.files) expect(sha(read(file.path))).toBe(file.sha256Lf);
  });
});
