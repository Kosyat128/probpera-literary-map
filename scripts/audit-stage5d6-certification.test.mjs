import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  STAGE5D6_DATASET_LABELS,
  STAGE5D6_DATASET_SIZES,
  auditStage5d6SourceContracts,
  buildStage5d6Certification,
} from "./audit-stage5d6-certification.mjs";

describe("Stage 5D-6 static and deterministic certification", () => {
  it("fails closed when the governed sources are unavailable", () => {
    const missing = auditStage5d6SourceContracts({
      root: path.join(process.cwd(), "missing-stage5d6-source-root"),
    });

    expect(missing.status).toBe("FAIL");
    expect(missing.contracts.every(({ status }) => status === "FAIL")).toBe(true);
  });

  it("certifies required source contracts and bounded helper datasets", async () => {
    const report = await buildStage5d6Certification({ root: process.cwd() });

    expect(report.status).toBe("PASS");
    expect(report.failures).toEqual([]);
    expect(report.sourceContracts.every(({ status }) => status === "PASS")).toBe(true);
    expect(report.helperMetrics?.datasetSizes).toEqual(STAGE5D6_DATASET_SIZES);
    expect(report.helperMetrics?.datasetLabels).toEqual(STAGE5D6_DATASET_LABELS);
    expect(report.helperMetrics?.datasets.every(({ status }) => status === "PASS"))
      .toBe(true);
    expect(report.helperMetrics?.maxima).toMatchObject({
      liveWorkingSet: 21,
      shelfTextures: 32,
      selectedHighResolutionTextures: 1,
    });
    expect(report.helperMetrics?.maxima.logicalBooks).toBeGreaterThanOrEqual(10_000);

    const current = report.helperMetrics?.datasets.find(
      ({ label }) => label === "current",
    );
    expect(current).toMatchObject({
      label: "current",
      source: "canonical-book-archive",
      status: "PASS",
    });
    expect(current?.logicalBooks).toBeGreaterThan(0);
    expect(current?.rawArchiveBooks).toBeGreaterThanOrEqual(current?.logicalBooks || 0);
    expect(current?.profiles.every(({ windows }) =>
      windows.every(({ includesAnchor }) => includesAnchor),
    )).toBe(true);

    const largest = report.helperMetrics?.datasets.at(-1);
    expect(largest?.profiles.map(({ profile, maximumWorkingSet }) => ({
      profile,
      maximumWorkingSet,
    }))).toEqual([
      { profile: "HIGH", maximumWorkingSet: 21 },
      { profile: "BALANCED", maximumWorkingSet: 13 },
      { profile: "ECONOMY", maximumWorkingSet: 7 },
    ]);
    expect(
      largest?.profiles.every(({ windows }) =>
        windows.every(({ includesAnchor }) => includesAnchor),
      ),
    ).toBe(true);
  }, 30_000);
});
