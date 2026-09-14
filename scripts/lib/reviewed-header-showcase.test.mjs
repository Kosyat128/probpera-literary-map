import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headerShowcaseAttestation, projectReviewedHeaderShowcase } from "./reviewed-header-showcase.mjs";
import { headerLibraryAttestation, projectReviewedHeaderLibrary } from "./reviewed-header-library.mjs";
import { projectReviewedNativeArchiveTransport } from "./reviewed-native-archive-transport.mjs";

const read = path => projectReviewedNativeArchiveTransport(path, readFileSync(path, "utf8"));
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = [
  "scripts/lib/reviewed-r49n-package.test.mjs",
  "src/index.css",
  "src/styles/navigation-panels.css",
  "src/utils/editorialImagePresentation.test.ts",
  "tests/e2e/header-hero-polish.spec.mjs",
];

describe("September 14 owner-approved complete article showcase", () => {
  it("pins the exact composition, authored image width, contracts and nested report adapter", () => {
    expect(sha(JSON.stringify(headerShowcaseAttestation))).toBe("d59b4fbf7dd9a554184a6b998840168b6aa8afff6246d5076bf4a0f6fab5e42d");
    expect(headerShowcaseAttestation).toMatchObject({
      id: "HEADER-SHOWCASE-OWNER-REFINEMENT-20260914",
      baselineSourceCommitSha: "d6c7849ccc5285e17c6da9ef147fecc9fdd0f000",
      reviewStatus: "source-reviewed",
    });
    expect(headerShowcaseAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(headerShowcaseAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(headerShowcaseAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(headerShowcaseAttestation.projections.map(delta => delta.id)).size)
      .toBe(headerShowcaseAttestation.projections.length);
    for (const delta of headerShowcaseAttestation.projections) {
      expect(paths).toContain(delta.path);
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after).not.toBe("");
    }
  });

  it.each(paths)("restores exact prior bytes and rejects removal, duplication or tampering in %s", path => {
    const source = read(path), previous = projectReviewedHeaderShowcase(path, source);
    expect(sha(source)).toBe(headerShowcaseAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(headerShowcaseAttestation.sourceBaselines[path]);
    expect(projectReviewedHeaderShowcase(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    const unrelated = "\n/* Unreviewed bytes remain protected. */\n";
    expect(projectReviewedHeaderShowcase(path, source + unrelated)).toBe(previous + unrelated);
    expect(sha(previous + unrelated)).not.toBe(headerShowcaseAttestation.sourceBaselines[path]);
    const deltas = headerShowcaseAttestation.projections.filter(delta => delta.path === path);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedHeaderShowcase(path, changed))
          .toThrow("Missing or duplicate reviewed header showcase delta");
      }
    }
  });

  it("preserves every historical packet and restores both nested expected report hashes", () => {
    for (const file of headerShowcaseAttestation.historicalArtifacts)
      expect(sha(read(file.path))).toBe(file.sha256Lf);
    const css = "src/styles/navigation-panels.css";
    expect(sha(projectReviewedHeaderLibrary(css, projectReviewedHeaderShowcase(css, read(css)))))
      .toBe(headerLibraryAttestation.sourceBaselines[css]);
    const e2e = "tests/e2e/header-hero-polish.spec.mjs";
    const r49 = JSON.parse(read("reports/book-r49n-package-reviewed-20260912.json"));
    expect(sha(projectReviewedHeaderShowcase(e2e, read(e2e))))
      .toBe(r49.releaseIntegration.supportingFiles.find(file => file.path === e2e).sha256Lf);
    const test = "scripts/lib/reviewed-r49n-package.test.mjs";
    const reference = JSON.parse(read("reports/library-reference-release-reviewed-20260914.json"));
    expect(sha(projectReviewedHeaderShowcase(test, read(test))))
      .toBe(reference.files.find(file => file.path === test).sha256Lf);
  });

  it("does not exempt article text, selection logic, image delivery or database sources", () => {
    for (const path of ["src/components/HeaderArticlesMenu.tsx", "src/styles/site-typography.css", "src/data/bookArchive.ts",
      "scripts/prepare-public-images.mjs", "scripts/sync-literary-archive.mjs", ".github/workflows/quality.yml",
      "public/cms/articles/published-articles.json", "unreviewed.css"]) {
      const text = "Unreviewed content\n";
      expect(projectReviewedHeaderShowcase(path, text)).toBe(text);
      expect(projectReviewedHeaderShowcase(path, text + "changed\n")).toBe(text + "changed\n");
    }
  });

  it("binds the exact implementation and the measured local composition without a deployment claim", () => {
    const entry = headerShowcaseAttestation.reviewedReport;
    const text = read(entry.path), report = JSON.parse(text);
    expect(sha(text)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({
      humanReview: false, productionApplied: false, historicalPinsChanged: false,
      articleTextChanged: false, articleSelectionChanged: false, imageDeliveryChanged: false,
      databaseSourcesChanged: false, broadSourceExclusionsAdded: false,
    });
    for (const file of [...report.files, ...report.unchangedFiles]) expect(sha(read(file.path))).toBe(file.sha256Lf);
    expect(report.geometry.snapshotCount).toBe(169);
    expect(report.geometry.errors).toEqual([]);
    expect(report.geometry.results).toHaveLength(5);
    for (const result of report.geometry.results) {
      if (result.isDesktop) {
        expect(result.visibleCards).toBe(6);
        expect(result.panelBottom).toBeLessThanOrEqual(result.height);
        expect(result.imageFit).toBe("contain");
        expect(result.textOverflows).toBe(0);
        expect(result.horizontalOverflow).toBe(0);
        expect(result.verticalOverflow).toBe(0);
      } else {
        expect(result.mobileJournalVisible).toBe(true);
        expect(result.horizontalOverflow).toBe(0);
      }
    }
  });
});
