import { describe, expect, it } from "vitest";

import { countries } from "./index";
import { auditCountryArchive } from "./editorialAudit";

describe("country editorial audit biography statuses", () => {
  it("counts strict locale-profile statuses independently from legacy card status", () => {
    const summary = auditCountryArchive(countries);

    expect(summary.totalWriters).toBe(1_684);
    expect(summary.russianBiographiesReady).toBe(1_684);
    expect(summary.russianBiographiesVerified).toBe(1_684);
    expect(summary.russianBiographiesWithheld).toBe(0);
    expect(summary.englishBiographiesReviewed).toBe(
      summary.englishBiographiesReady
    );
    expect(summary.englishBiographiesVerified).toBe(0);
  });
});
