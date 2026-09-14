import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { premiumTitleEvidenceAttestation, projectReviewedPremiumTitleEvidence } from "./reviewed-premium-title-evidence.mjs";
import { projectPublishedCmsSourcePunctuation } from "./reviewed-cms-source-punctuation.mjs";
import { projectPublishedNativeArchiveRead, projectReviewedNativeArchiveRead } from "./reviewed-native-archive-read.mjs";

const read = path => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = ["scripts/export-premium-translations.mjs", "scripts/export-published-content.fixture.test.mjs",
  "scripts/lib/reviewed-cms-source-punctuation.mjs", "scripts/lib/reviewed-cms-source-punctuation.test.mjs",
  "scripts/lib/reviewed-native-archive-read.test.mjs"];

describe("Premium contained-title evidence additive governance", () => {
  it("pins only the reviewed serializer, its regression fixture and three read adapters", () => {
    expect(sha(JSON.stringify(premiumTitleEvidenceAttestation))).toBe("7c69ef0c294cc7ac993a4f28ef117a8f3b73b68ffbf3ea9ac1e687319ae2e22b");
    expect(premiumTitleEvidenceAttestation).toMatchObject({
      id: "PREMIUM-TITLE-EVIDENCE-REVIEWED-20260914",
      baselineSourceCommitSha: "4b8983e60c07d3bb0f4607ce41e5b3d322d82563",
      reviewStatus: "source-reviewed",
    });
    expect(premiumTitleEvidenceAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(premiumTitleEvidenceAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(premiumTitleEvidenceAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(premiumTitleEvidenceAttestation.projections.map(delta => delta.id)).size)
      .toBe(premiumTitleEvidenceAttestation.projections.length);
  });

  it.each(paths)("restores exact published Git bytes and fails closed on changed fragments in %s", path => {
    const source = read(path), previous = projectReviewedPremiumTitleEvidence(path, source);
    const gitSource = execFileSync("git", ["show", `${premiumTitleEvidenceAttestation.baselineSourceCommitSha}:${path}`],
      { encoding: "utf8", maxBuffer: 512 * 1024 }).replace(/\r\n?/gu, "\n");
    expect(previous).toBe(gitSource);
    expect(sha(source)).toBe(premiumTitleEvidenceAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(premiumTitleEvidenceAttestation.sourceBaselines[path]);
    expect(projectReviewedPremiumTitleEvidence(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    expect(projectReviewedNativeArchiveRead(path, source)).toBe(
      projectPublishedNativeArchiveRead(path, projectPublishedCmsSourcePunctuation(path, previous))
    );
    const unrelated = "\n/* Unreviewed content remains protected. */\n";
    expect(projectReviewedPremiumTitleEvidence(path, source + unrelated)).toBe(previous + unrelated);
    expect(sha(previous + unrelated)).not.toBe(premiumTitleEvidenceAttestation.sourceBaselines[path]);
    for (const delta of premiumTitleEvidenceAttestation.projections.filter(delta => delta.path === path)) {
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after).not.toBe("");
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedPremiumTitleEvidence(path, changed)).toThrow("Missing or duplicate reviewed premium title-evidence delta");
        expect(() => projectReviewedNativeArchiveRead(path, changed)).toThrow("Missing or duplicate reviewed premium title-evidence delta");
      }
    }
  });

  it("keeps published packets, all 39 migrations and validation/publication guards unchanged", () => {
    expect(premiumTitleEvidenceAttestation.historicalMigrations).toHaveLength(39);
    for (const file of [...premiumTitleEvidenceAttestation.historicalArtifacts,
      ...premiumTitleEvidenceAttestation.historicalMigrations, ...premiumTitleEvidenceAttestation.unchangedCoreFiles]) {
      expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
    }
  });

  it("binds the real direct-CMS proof without claiming a fresh complete export or publication", () => {
    const entry = premiumTitleEvidenceAttestation.reviewedReport;
    const source = read(entry.path), report = JSON.parse(source);
    expect(sha(source)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({ historicalPinsChanged: false, historicalMigrationsChanged: false,
      databaseChanged: false, validatorChanged: false, archiveOverlayChanged: false,
      productionApplied: false, humanReview: false, broadSourceExclusionsAdded: false,
      directEvidence: { profileCount: 69, issuesBefore: 16, affectedBooks: 9, issuesAfter: 0,
        staticArchiveOverlayUsed: false, completeFreshExportClaim: false } });
    expect(report.preservesFields).toEqual(["titleRelation", "analyticTitleExact", "containerTitleExact", "containedInField"]);
    expect(report.preservesSourceEnums).toEqual(["container-title", "contained-title"]);
    for (const file of report.files) expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
  });

  it("does not exempt generated data, SQL, ordinary exports or unrelated source", () => {
    for (const path of ["src/data/cms/literaryWorks.generated.ts", "public/cms/published-content.json",
      "src/data/bookArchive.ts", "src/data/bookEvidence.ts", "scripts/export-published-content.mjs",
      "supabase/migrations/20260914_literary_translation_draft_storage.sql", "unreviewed.mjs"]) {
      expect(projectReviewedPremiumTitleEvidence(path, "Unreviewed content\n")).toBe("Unreviewed content\n");
    }
  });
});
