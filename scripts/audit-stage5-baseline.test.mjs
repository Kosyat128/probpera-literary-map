import { describe, expect, it } from "vitest";

import {
  buildStage5Baseline,
  parseCss,
  selectorMatches,
  splitSelectors,
} from "./audit-stage5-baseline.mjs";
import {
  governanceFingerprintRegistry,
  sourceReviewRegistry,
} from "./stage5-baseline-registry.mjs";

describe("Stage 5A baseline audit", () => {
  it("splits grouped selectors without splitting functional selector arguments", () => {
    expect(splitSelectors('.card, :is(.one, .two), [data-copy="a,b"]')).toEqual([
      ".card",
      ":is(.one, .two)",
      '[data-copy="a,b"]',
    ]);
  });

  it("captures declarations and media context while ignoring keyframe frames", () => {
    const rules = parseCss(`
      .card, .panel { color: #fff; padding: 8px; }
      @media (max-width: 600px) {
        html[lang="en"] .card { font-size: 16px; }
      }
      @keyframes pulse { to { transform: scale(1.1); } }
    `);

    expect(rules.map((rule) => rule.selector)).toEqual([
      ".card",
      ".panel",
      'html[lang="en"] .card',
    ]);
    expect(rules[2].contexts).toEqual(["@media (max-width: 600px)"]);
    expect(rules[2].declarations).toEqual([
      { property: "font-size", value: "16px" },
    ]);
  });

  it("matches exact, state, and family selector boundaries deterministically", () => {
    expect(selectorMatches(".button:hover", ".button", "state")).toBe(true);
    expect(selectorMatches(".button > svg", ".button", "family")).toBe(true);
    expect(selectorMatches(".button__icon", ".button", "family")).toBe(false);
    expect(selectorMatches(".button:hover", ".button", "exact")).toBe(false);
  });

  it("builds all required inventories from the pinned main commit", () => {
    const generated = buildStage5Baseline({ root: process.cwd() });
    expect(Object.keys(generated.inventories.categories)).toEqual([
      "typography",
      "spacing",
      "colors",
      "buttons",
      "backgrounds",
      "motion",
      "card-families",
    ]);
    expect(generated.baseline.provenance.baseMainSha).toBe(
      "8c24038510324d00086afe05b8de78b0f09ae52e"
    );
    expect(generated.baseline.performance.production.artifact.status).toBe(
      "MEASURED"
    );
    expect(generated.baseline.performance.production.artifact).toMatchObject({
      files: 4383,
      bytes: 115067016,
      manifestSha256:
        "5cfcdf9e48c6377398dc62bad7aac89d163bda811a3e5a7d3b3d49a963a58ef8",
    });
    expect(generated.baseline.performance.productionEvidence).toMatchObject({
      status: "PASS",
      classification: "EXACT_GITHUB_PAGES_ARTIFACT",
      acceptanceEvidence: true,
      source: {
        runId: 32719497676,
        artifactId: 9517505146,
        releaseHead: {
          commitSha: "8c24038510324d00086afe05b8de78b0f09ae52e",
        },
      },
    });
    expect(generated.baseline.performance.localDistDiagnostic).toEqual({
      status: "NOT RUN",
      classification: "LOCAL_INTEGRATION_WORKTREE_DIAGNOSTIC_NOT_PRODUCTION_ARTIFACT",
      acceptanceEvidence: false,
      command: "npm run stage5:baseline:verify-dist",
    });
    expect(generated.baseline.sectionLandmarks.currentHomepageOrder).toEqual([
      "Hero",
      "Globe",
      "Book Month",
      "Book Archive",
      "Featured Journal",
      "Article Library",
      "Community",
      "Authors",
      "Sections",
      "Trust",
      "Calendar",
      "Footer",
    ]);
    expect(generated.baseline.sourceReview).toHaveLength(sourceReviewRegistry.length);
    expect(generated.baseline.governanceFingerprints).toEqual(
      governanceFingerprintRegistry.map(({ id, paths, classTokens, expected }) => ({
        id,
        paths,
        ...(classTokens ? { classTokens } : {}),
        expected,
      }))
    );
    expect(JSON.stringify(generated.files)).not.toContain("local production dist/");
    expect(generated.baseline.runtimeObservedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "A11Y-FORCED-COLORS-GLOBAL-SEARCH-FOCUS",
          decision: "FIX",
        }),
      ])
    );
    expect(generated.inventories.summary).toMatchObject({
      KEEP: expect.any(Number),
      TUNE: expect.any(Number),
      FIX: expect.any(Number),
    });
    expect(Object.keys(generated.files)).toHaveLength(16);
  }, 20_000);
});
