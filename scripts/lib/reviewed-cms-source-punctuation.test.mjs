import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cmsSourcePunctuationAttestation, projectPublishedCmsSourcePunctuation as projectReviewedCmsSourcePunctuation } from "./reviewed-cms-source-punctuation.mjs";
import { projectReviewedPremiumTitleEvidence } from "./reviewed-premium-title-evidence.mjs";
import { nativeArchiveReadAttestation, projectPublishedNativeArchiveRead, projectReviewedNativeArchiveRead } from "./reviewed-native-archive-read.mjs";

const read = path => projectReviewedPremiumTitleEvidence(path, readFileSync(path, "utf8"));
const sha = text => createHash("sha256").update(text).digest("hex");
const paths = ["scripts/lib/reviewed-native-archive-read.mjs",
  "scripts/lib/reviewed-native-archive-read.test.mjs", "scripts/normalize-short-hyphens.mjs"];

describe("CMS source punctuation additive governance", () => {
  it("pins only the checker and two historical read adapters against published main", () => {
    expect(sha(JSON.stringify(cmsSourcePunctuationAttestation))).toBe("007f0515ecb28038f28763b482bc0194ab9f2054c4dd3b6aafd0f22d86d475bf");
    expect(cmsSourcePunctuationAttestation).toMatchObject({
      id: "CMS-SOURCE-PUNCTUATION-REVIEWED-20260914",
      baselineSourceCommitSha: "199a9c5b4209f1ea917e08ed96362a44fee6379e",
      reviewStatus: "source-reviewed",
    });
    expect(cmsSourcePunctuationAttestation.allowedProjectionPaths).toEqual(paths);
    expect(Object.keys(cmsSourcePunctuationAttestation.sourceBaselines).sort()).toEqual(paths);
    expect(Object.keys(cmsSourcePunctuationAttestation.reviewedSourceSha256).sort()).toEqual(paths);
    expect(new Set(cmsSourcePunctuationAttestation.projections.map(delta => delta.id)).size)
      .toBe(cmsSourcePunctuationAttestation.projections.length);
  });

  it.each(paths)("restores exact historical bytes and rejects missing, duplicate or changed deltas in %s", path => {
    const source = read(path), previous = projectReviewedCmsSourcePunctuation(path, source);
    const currentSource = readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
    expect(sha(source)).toBe(cmsSourcePunctuationAttestation.reviewedSourceSha256[path]);
    expect(sha(previous)).toBe(cmsSourcePunctuationAttestation.sourceBaselines[path]);
    expect(projectReviewedCmsSourcePunctuation(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    expect(projectReviewedNativeArchiveRead(path, currentSource)).toBe(projectPublishedNativeArchiveRead(path, previous));
    expect(projectReviewedCmsSourcePunctuation(path, source + "\nUnreviewed\n")).toBe(previous + "\nUnreviewed\n");
    expect(sha(previous + "\nUnreviewed\n")).not.toBe(cmsSourcePunctuationAttestation.sourceBaselines[path]);
    for (const delta of cmsSourcePunctuationAttestation.projections.filter(delta => delta.path === path)) {
      expect(delta.before).not.toBe(delta.after);
      expect(delta.after).not.toBe("");
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after,
        source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedCmsSourcePunctuation(path, changed)).toThrow("Missing or duplicate reviewed CMS punctuation delta");
      }
      for (const changed of [currentSource.replace(delta.after, ""), currentSource + delta.after,
        currentSource.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedNativeArchiveRead(path, changed)).toThrow("Missing or duplicate reviewed CMS punctuation delta");
      }
    }
  });

  it("preserves all published packets, 39 SQL files and production publication gates", () => {
    expect(sha(JSON.stringify(nativeArchiveReadAttestation))).toBe("8c363a4c1e88f6a8c46b163b6937a7c357611bfdfe8a9d218866f869bb17b686");
    expect(cmsSourcePunctuationAttestation.historicalMigrations).toHaveLength(39);
    for (const file of [...cmsSourcePunctuationAttestation.historicalArtifacts,
      ...cmsSourcePunctuationAttestation.historicalMigrations, ...cmsSourcePunctuationAttestation.unchangedCoreFiles]) {
      expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
    }
  });

  it("does not exempt generated snapshots, source transcriptions or unrelated files from historical locks", () => {
    for (const path of ["src/data/cms/literaryWorks.generated.ts", "public/cms/published-content.json",
      "src/data/countries/bookR49nDickensReviewed20260912.ts", "scripts/export-published-content.mjs", "unreviewed.mjs"]) {
      expect(projectReviewedCmsSourcePunctuation(path, "Unreviewed content\n")).toBe("Unreviewed content\n");
    }
  });

  it("binds the exact checker implementation and states its source-only scope", () => {
    const entry = cmsSourcePunctuationAttestation.reviewedReport;
    const source = read(entry.path), report = JSON.parse(source);
    expect(sha(source)).toBe(entry.sha256Lf);
    expect(report).toMatchObject({ historicalPinsChanged: false, historicalMigrationsChanged: false,
      exportedBytesChanged: false, databaseChanged: false, displayTextExceptionAdded: false,
      wholeGeneratedFileExemptionAdded: false, productionApplied: false,
      humanReview: false, protectedBookIdentities: 7, protectedFieldIdentities: 14 });
    for (const file of report.files) expect(sha(read(file.path)), file.path).toBe(file.sha256Lf);
  });
});
