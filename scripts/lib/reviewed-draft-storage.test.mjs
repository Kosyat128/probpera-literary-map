import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftStorageAttestation, projectReviewedDraftStorage } from "./reviewed-draft-storage.mjs";
import {
  nativeArchiveTransportAttestation,
  projectPublishedNativeArchiveTransport,
  projectReviewedNativeArchiveTransport,
} from "./reviewed-native-archive-transport.mjs";

const read = path => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = [
  ".github/workflows/reconcile-production-database.yml",
  "scripts/database/build-production-migration-plan.mjs",
  "scripts/database/production-migration-plan.test.mjs",
  "scripts/lib/reviewed-native-archive-transport.mjs",
  "scripts/lib/reviewed-native-archive-transport.test.mjs",
];

describe("Unreviewed draft storage additive governance", () => {
  it("pins only the exact migration-plan and two adapter changes against published main", () => {
    expect(sha(JSON.stringify(draftStorageAttestation))).toBe("e302fa48a42797b5ba7626d60dd847987f62c5864cd56e8acfdc87c19a7b5df2");
    expect(draftStorageAttestation).toMatchObject({
      id: "LITERARY-TRANSLATION-DRAFT-STORAGE-20260914",
      baselineSourceCommitSha: "6dd83837571b434a066c0f0e952107b41149a11d",
      reviewStatus: "source-reviewed",
    });
    expect(draftStorageAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(draftStorageAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(draftStorageAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(draftStorageAttestation.projections.map(delta => delta.id)).size)
      .toBe(draftStorageAttestation.projections.length);
    for (const delta of draftStorageAttestation.projections) {
      expect(paths).toContain(delta.path);
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after).not.toBe("");
    }
  });

  it.each(paths)("restores exact published bytes and rejects altered fragments in %s", path => {
    const source = read(path), previous = projectReviewedDraftStorage(path, source);
    expect(sha(source)).toBe(draftStorageAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(draftStorageAttestation.sourceBaselines[path]);
    expect(projectReviewedDraftStorage(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    expect(projectReviewedNativeArchiveTransport(path, source))
      .toBe(projectPublishedNativeArchiveTransport(path, previous));
    const unrelated = "\n/* Unreviewed changes remain visible to historical locks. */\n";
    expect(projectReviewedDraftStorage(path, source + unrelated)).toBe(previous + unrelated);
    expect(sha(previous + unrelated)).not.toBe(draftStorageAttestation.sourceBaselines[path]);
    const deltas = draftStorageAttestation.projections.filter(delta => delta.path === path);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedDraftStorage(path, changed))
          .toThrow("Missing or duplicate reviewed draft-storage delta");
        expect(() => projectReviewedNativeArchiveTransport(path, changed))
          .toThrow("Missing or duplicate reviewed draft-storage delta");
      }
    }
  });

  it("preserves every published packet, all 38 historical SQL files and publication gates", () => {
    expect(sha(JSON.stringify(nativeArchiveTransportAttestation)))
      .toBe("cb78cfa458794e0aaf68bfaefd54ef012f9ce7d3a41edb98729b44db1854413c");
    expect(draftStorageAttestation.historicalMigrations).toHaveLength(38);
    for (const file of [...draftStorageAttestation.historicalArtifacts,
      ...draftStorageAttestation.historicalMigrations,
      ...draftStorageAttestation.unchangedCoreFiles]) {
      expect(sha(read(file.path))).toBe(file.sha256Lf);
    }
  });

  it("does not exempt migration SQL, editorial data, cover export or unrelated files", () => {
    for (const path of [
      "supabase/migrations/20260914_literary_translation_draft_storage.sql",
      "supabase/migrations/20260808_book_translations_and_import_staging.sql",
      "scripts/sync-literary-archive.mjs", "src/data/bookArchive.ts",
      "data/book-canon-source-registry.json", "scripts/export-published-content.mjs",
      "unreviewed.mjs",
    ]) {
      expect(projectReviewedDraftStorage(path, "Unreviewed content\n"))
        .toBe("Unreviewed content\n");
    }
  });

  it("binds exact implementation and states the storage-only limits without production claims", () => {
    const entry = draftStorageAttestation.reviewedReport;
    const text = read(entry.path), report = JSON.parse(text);
    expect(sha(text)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({
      baselineSourceCommitSha: "6dd83837571b434a066c0f0e952107b41149a11d",
      humanReview: false, productionApplied: false,
      historicalPinsChanged: false, historicalMigrationsChanged: false,
      editorialTextChanged: false, provenanceInvented: false,
      publicationGatesChanged: false, nativeTransportChanged: false,
      broadSourceExclusionsAdded: false,
      shortDraftPredicate: "editorial_status = 'draft' AND reviewed_at IS NULL AND char_length(description) BETWEEN 1 AND 139 AND description ~ '[^[:space:]]'",
    });
    for (const file of report.files) expect(sha(read(file.path))).toBe(file.sha256Lf);
    expect(report.schemaMigration.filename)
      .toBe("20260914_literary_translation_draft_storage.sql");
    expect(report.schemaMigration.ordinal).toBe(39);
  });
});
