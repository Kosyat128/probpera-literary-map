import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./export-published-content.mjs", import.meta.url),
  "utf8"
);
const metadataNormalizer = readFileSync(
  new URL("./normalize-cms-snapshot-metadata.mjs", import.meta.url),
  "utf8"
);

describe("CMS withdrawal export contract", () => {
  it("publishes verified legacy tombstones through both runtime snapshots", () => {
    expect(source).toContain("buildLegacyArticleWithdrawals");
    expect(source).toContain("partitionRedirectsByWithdrawnDestination");
    expect(source).toContain("withdrawnLegacyArticles");
    expect(source).toContain('"cmsWithdrawnLegacyArticles"');
    expect(source).toContain("articleWithdrawalsModule");
    expect(source.indexOf("const withdrawalStates")).toBeLessThan(
      source.indexOf("const withdrawnLegacyArticles")
    );
    expect(source.indexOf("const replacement = assertCandidateCanReplaceBaseline")).toBeLessThan(
      source.indexOf("await commitAtomicFileSet")
    );
    expect(metadataNormalizer).toContain("normalizeLegacyArticleWithdrawals");
    expect(metadataNormalizer).toContain("generatedWithdrawals");
    expect(metadataNormalizer).toContain("asGeneratedWithdrawalsModule");
  });
});
