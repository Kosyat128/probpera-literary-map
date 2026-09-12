import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isReviewedR49nPackageAddition, projectReviewedR49nPackage,
  r49nPackageAttestation, reviewedR49nPackageSourceSha256,
} from "./reviewed-r49n-package.mjs";

const read = path => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
const sha = value => createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

describe("R49N common package additive governance", () => {
  it("pins the common packet without replacing the historical Dickens attestation", () => {
    expect(sha(JSON.stringify(r49nPackageAttestation))).toBe(
      "5512c24d899ad0f8bbcc934fe2fc0c2d93643d465931ea8e96dc47484a755677"
    );
    expect(sha(JSON.stringify(JSON.parse(read("scripts/governance/book-r49n-dickens-reviewed-20260912.json")))))
      .toBe("2fd2b7dbbb6fe34040aba24e6dfef4a8498d6a01f4ae753698715abe72c408f6");
    expect(r49nPackageAttestation.baselineSourceCommitSha).toBe("4ed87afa5aef95a650be213c982da5cf662f7469");
    expect(r49nPackageAttestation.allowedProjectionPaths).toEqual([
      ".github/workflows/reconcile-production-database.yml",
      "apps/admin/catalog-assets/editorial-catalog.json",
      "apps/admin/catalog-assets/interface-copy-catalog.json",
      "apps/admin/lib/editorial-catalog.ts",
      "data/book-canon-source-registry.json",
      "scripts/archive-source.ts",
      "scripts/database/build-production-migration-plan.mjs",
      "scripts/import-user-supplied-book-covers.mjs",
      "scripts/import-user-supplied-book-covers-2026-08-13.mjs",
      "scripts/import-user-supplied-book-covers-2026-08-20.mjs",
      "scripts/sync-literary-archive.mjs",
      "src/App.tsx",
      "src/books/bookDossierLegacyAdapter.ts",
      "src/books/bookEditorialPages.ts",
      "src/components/BookArchiveSection.tsx",
      "src/components/BookShelfControls.tsx",
      "src/components/GlobalSearch.tsx",
      "src/components/WriterPanel.tsx",
      "src/data/bookArchive.ts",
      "src/data/bookArchiveQueue.ts",
      "src/data/countries/index.ts",
      "src/i18n/InterfaceLanguage.tsx",
      "src/search/globalSearchIndex.ts",
      "vite.config.ts",
    ]);
    expect(r49nPackageAttestation.additions.map(addition => addition.path)).toEqual([
      "src/data/countries/bookR49nExistingReviewed20260912.ts",
      "src/data/countries/bookR49nStoweRecovered20260912.ts",
      "src/data/countries/bookR49nAlcottDraft20260912.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data01.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data02.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data03.ts",
    ]);
    expect(r49nPackageAttestation.runtime).toMatchObject({
      beforeReadyCount: 46, afterReadyCount: 69, beforeCanonicalCount: 9761, canonicalCount: 9763,
      pendingCount: 9694, retainedPendingPairCount: 1494,
    });
  });

  it.each(r49nPackageAttestation.allowedProjectionPaths)("reverses only exact additions in %s", path => {
    const source = read(path), projected = projectReviewedR49nPackage(path, source);
    expect(reviewedR49nPackageSourceSha256(projected)).toBe(r49nPackageAttestation.sourceBaselines[path]);
    const unrelated = "\n/* Unreviewed change must remain visible to the old lock. */\n";
    expect(projectReviewedR49nPackage(path, source + unrelated)).toBe(projected + unrelated);
    expect(reviewedR49nPackageSourceSha256(projected + unrelated))
      .not.toBe(r49nPackageAttestation.sourceBaselines[path]);
    for (const delta of r49nPackageAttestation.projections.filter(delta => delta.path === path)) {
      for (const changed of [
        source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?")),
      ]) {
        expect(() => projectReviewedR49nPackage(path, changed))
          .toThrow("Missing or duplicate reviewed R49N package delta");
      }
    }
  });

  it("registers seven exact institutions while preserving all previous roles and canon decisions", () => {
    const path = r49nPackageAttestation.registry.path, text = read(path);
    const current = JSON.parse(text), previous = JSON.parse(projectReviewedR49nPackage(path, text));
    expect(current).toEqual({
      ...previous, authorities: [...previous.authorities, ...r49nPackageAttestation.registry.addedAuthorities],
    });
    expect(r49nPackageAttestation.registry.addedAuthorities).toHaveLength(7);
    expect(sha(text)).toBe(r49nPackageAttestation.registry.afterSha256);
    expect(sha(projectReviewedR49nPackage(path, text))).toBe(r49nPackageAttestation.registry.beforeSha256);
    const changed = text.replace(
      `"independenceGroup": ${JSON.stringify(previous.authorities[0].independenceGroup)}`,
      '"independenceGroup": "unreviewed-group"');
    expect(changed).not.toBe(text);
    expect(sha(projectReviewedR49nPackage(path, changed)))
      .not.toBe(r49nPackageAttestation.registry.beforeSha256);
    expect(current.authorities.find(authority => authority.authorityId === "project-gutenberg").allowedRoles)
      .toEqual(["title-publisher"]);
  });

  it("excludes only seven exact source modules, including consistent Windows newlines", () => {
    for (const addition of r49nPackageAttestation.additions) {
      const text = read(addition.path);
      expect(isReviewedR49nPackageAddition(addition.path, text)).toBe(true);
      expect(isReviewedR49nPackageAddition(addition.path, text.replaceAll("\n", "\r\n"))).toBe(true);
      expect(isReviewedR49nPackageAddition(addition.path, text + "\n")).toBe(false);
      expect(isReviewedR49nPackageAddition(addition.path, text.replace(/\S/u, "?"))).toBe(false);
      expect(isReviewedR49nPackageAddition(addition.path.replace("20260912", "20260913"), text)).toBe(false);
    }
    for (const path of ["src/data/countries/unreviewed.ts", "src/data/bookEvidence.ts"]) {
      expect(isReviewedR49nPackageAddition(path, read(r49nPackageAttestation.additions[0].path))).toBe(false);
      expect(projectReviewedR49nPackage(path, "unrelated source")).toBe("unrelated source");
    }
  });

  it("adds only the two minimal private author references and preserves the previous catalog", () => {
    const path = "apps/admin/catalog-assets/editorial-catalog.json";
    const source = read(path);
    const current = JSON.parse(source);
    const previous = JSON.parse(projectReviewedR49nPackage(path, source));
    const addedIds = new Set(["harriet_beecher_stowe", "louisa_may_alcott"]);
    const withoutAdditions = {
      ...current,
      countries: current.countries.map(country => country.id === "usa"
        ? { ...country, writers: country.writers.filter(writer => !addedIds.has(writer.id)) }
        : country),
    };
    expect(withoutAdditions).toEqual(previous);
    const added = current.countries.find(country => country.id === "usa").writers
      .filter(writer => addedIds.has(writer.id));
    expect(added).toHaveLength(2);
    for (const writer of added) {
      expect(Object.keys(writer).sort()).toEqual(["fields", "id", "label"]);
      expect(Object.keys(writer.fields).every(key => ["name", "country", "language"].includes(key))).toBe(true);
    }
  });

  it("binds the complete retained editorial evidence and the unchanged source dossiers", () => {
    const report = JSON.parse(read(r49nPackageAttestation.editorialReview.path));
    expect(sha(JSON.stringify(canonical(report))))
      .toBe(r49nPackageAttestation.editorialReview.canonicalJsonSha256);
    expect(report).toMatchObject({ humanReview: false, fullWorkRead: false, publicationApproved: false });
    expect(sha(read(report.earlierDickensReview.path))).toBe(report.earlierDickensReview.sha256);
    expect(sha(read(report.stoweRecovery.path))).toBe(report.stoweRecovery.sha256);
    expect(sha(read(report.retainedDraftDisplay.path))).toBe(report.retainedDraftDisplay.sha256);
    expect(report.retainedDraftDisplay).toMatchObject({ proseRewritten: false, newHumanApproval: false, evidenceV2ApprovalGranted: false });
    expect(sha(read(report.atomicRegistryTransition.migration.path))).toBe(report.atomicRegistryTransition.migration.sha256);
    expect(report.privateAuthorReferences).toMatchObject({ beforeCount: 1684, afterCount: 1686, existingRecordsChanged: [], newPublicBiographies: 0 });
    expect(report.fullCatalogUi.catalog).toMatchObject({ total: 9763, reviewed: 69, pending: 9694, evidenceGatesChanged: false });
    for (const file of report.fullCatalogUi.files) expect(sha(read(file.path))).toBe(file.sha256Lf);
    expect(report.historicalCoverChecks).toMatchObject({ status: "PASS", checkOnly: true, newCoverPublication: false, coverAssetsChanged: [] });
    for (const file of report.historicalCoverChecks.unchangedFiles) expect(sha(read(file.path))).toBe(file.sha256);
    expect(report.adminCatalogCompatibility.publicBiographyApprovalGranted).toBe(false);
    expect(report.existingRecovery.records).toHaveLength(12);
    expect(report.retainedTextProofs).toHaveLength(10);
    expect(report.runtimeValidation.newReadyKeys).toEqual(r49nPackageAttestation.runtime.newReadyKeys);
    for (const record of report.existingRecovery.records) {
      expect(record.humanReview).toBe(false);
      expect(record.fullWorkRead).toBe(false);
      for (const locale of ["ru", "en"]) {
        for (const field of ["author", "createdAt", "reviewedBy", "reviewedAt"]) {
          expect(record.candidateProvenance[locale][field]).toBe(record.historicProvenance[locale][field]);
        }
      }
    }
  });
});
