import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nativeArchiveReadAttestation, projectPublishedNativeArchiveRead as projectReviewedNativeArchiveRead } from "./reviewed-native-archive-read.mjs";
import { projectReviewedCmsSourcePunctuation } from "./reviewed-cms-source-punctuation.mjs";
import { draftStorageAttestation, projectPublishedDraftStorage, projectReviewedDraftStorage } from "./reviewed-draft-storage.mjs";

const read = path => projectReviewedCmsSourcePunctuation(path, readFileSync(path, "utf8"));
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = [
  ".github/workflows/reconcile-production-database.yml",
  "scripts/database/literary-archive-atomic-sync.test.mjs",
  "scripts/database/production-migration-plan.test.mjs",
  "scripts/export-premium-translations.mjs",
  "scripts/lib/literary-archive-cli-mode.mjs",
  "scripts/lib/reviewed-draft-storage.mjs",
  "scripts/lib/reviewed-draft-storage.test.mjs",
  "scripts/sync-literary-archive.mjs",
];

describe("Native archive read additive governance", () => {
  it("pins only explicit read-query repairs and two historical adapter changes", () => {
    expect(sha(JSON.stringify(nativeArchiveReadAttestation))).toBe("8c363a4c1e88f6a8c46b163b6937a7c357611bfdfe8a9d218866f869bb17b686");
    expect(nativeArchiveReadAttestation).toMatchObject({
      id: "LIBRARY-NATIVE-READ-REVIEWED-20260914",
      baselineSourceCommitSha: "bc765b4b39d41462e0c7f711d5cdc6ffeb589dbe",
      reviewStatus: "source-reviewed",
    });
    expect(nativeArchiveReadAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(nativeArchiveReadAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(nativeArchiveReadAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(nativeArchiveReadAttestation.projections.map(delta => delta.id)).size)
      .toBe(nativeArchiveReadAttestation.projections.length);
    for (const delta of nativeArchiveReadAttestation.projections) {
      expect(paths).toContain(delta.path);
      expect(delta.after).not.toBe("");
      expect(delta.before).not.toBe(delta.after);
    }
  });

  it.each(paths)("restores exact published bytes and fails closed on altered fragments in %s", path => {
    const source = read(path), previous = projectReviewedNativeArchiveRead(path, source);
    expect(sha(source)).toBe(nativeArchiveReadAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(nativeArchiveReadAttestation.sourceBaselines[path]);
    expect(projectReviewedNativeArchiveRead(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    expect(projectReviewedDraftStorage(path, source)).toBe(projectPublishedDraftStorage(path, previous));
    const unrelated = "\n/* Unreviewed source changes remain visible. */\n";
    expect(projectReviewedNativeArchiveRead(path, source + unrelated)).toBe(previous + unrelated);
    expect(sha(previous + unrelated)).not.toBe(nativeArchiveReadAttestation.sourceBaselines[path]);
    for (const delta of nativeArchiveReadAttestation.projections.filter(delta => delta.path === path)) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedNativeArchiveRead(path, changed)).toThrow("Missing or duplicate reviewed native-read delta");
        expect(() => projectReviewedDraftStorage(path, changed)).toThrow("Missing or duplicate reviewed native-read delta");
      }
    }
  });

  it("preserves all published packets, 39 SQL migrations and the atomic publication implementation", () => {
    expect(sha(JSON.stringify(draftStorageAttestation))).toBe("e302fa48a42797b5ba7626d60dd847987f62c5864cd56e8acfdc87c19a7b5df2");
    expect(nativeArchiveReadAttestation.historicalMigrations).toHaveLength(39);
    for (const file of [...nativeArchiveReadAttestation.historicalArtifacts,
      ...nativeArchiveReadAttestation.historicalMigrations, ...nativeArchiveReadAttestation.unchangedCoreFiles]) {
      expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
    }
  });

  it("does not exempt SQL, data, ordinary export, commit helpers or unrelated sources", () => {
    for (const path of ["supabase/migrations/20260914_literary_translation_draft_storage.sql",
      "scripts/lib/literary-archive-atomic-release.mjs", "scripts/lib/literary-archive-database-commit.mjs",
      "scripts/export-published-content.mjs",
      "src/data/bookArchive.ts", "unreviewed.mjs"]) {
      expect(projectReviewedNativeArchiveRead(path, "Unreviewed content\n")).toBe("Unreviewed content\n");
    }
  });

  it("binds current read-only implementation and honest committed-receipt proof limits", () => {
    const entry = nativeArchiveReadAttestation.reviewedReport;
    const source = read(entry.path), report = JSON.parse(source);
    expect(sha(source)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({
      historicalPinsChanged: false, historicalMigrationsChanged: false,
      atomicCommitChanged: false, editorialTextChanged: false,
      productionApplied: false, humanReview: false, broadSourceExclusionsAdded: false,
      allowedOperations: ["precondition", "postflight"],
      transaction: { readOnly: true, isolation: "repeatable read", statementTimeoutMs: 300000,
        lockTimeoutMs: 15000, role: "service_role", humanUid: null },
    });
    for (const file of report.files) expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
    expect(report.receiptBinding.independentLocalTargetRebuild).toBe(false);
    expect(report.receiptBinding.durableStagedContentAssertion).toBe(true);
  });
});
