import { describe, expect, it } from "vitest";

import { legacyWriterBiography } from "../writerBiography";
import {
  countries,
  writerBiographyFactReviewSourceCountries,
} from "./index";
import reviewOverlay from "./generated/writerBiographyFactReviewCorrections.generated.json";
import { writerBiographyFactReviewCounts } from "./writerBiographyFactReviews";
import reviewRollup from "../../../reports/writer-biography-fact-review-rollup.json";

function writerByKey(
  source: typeof countries,
  key: string
) {
  const [countryId, writerId] = key.split(":");
  return source
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

describe("writer biography fact-review overlay", () => {
  it("publishes only the compact proven correction set", () => {
    expect(writerBiographyFactReviewCounts).toEqual({
      reviewed: 600,
      corrected: 511,
    });
    expect(Object.keys(reviewOverlay.corrections)).toHaveLength(511);
    expect(reviewRollup.summary).toEqual({
      records: 600,
      unchanged: 64,
      corrected: 511,
      held: 25,
    });
  });

  it("changes a corrected text and preserves an unchanged one", () => {
    const correctedKey = "afghanistan:khalilullah_khalili";
    const unchangedKey = "afghanistan:atiq_rahimi";
    const correctedBefore = legacyWriterBiography(
      writerByKey(writerBiographyFactReviewSourceCountries, correctedKey)!
    );
    const correctedAfter = legacyWriterBiography(
      writerByKey(countries, correctedKey)!
    );
    const unchangedBefore = legacyWriterBiography(
      writerByKey(writerBiographyFactReviewSourceCountries, unchangedKey)!
    );
    const unchangedAfter = legacyWriterBiography(
      writerByKey(countries, unchangedKey)!
    );

    expect(correctedAfter).toBe(reviewOverlay.corrections[correctedKey]);
    expect(correctedAfter).not.toBe(correctedBefore);
    expect(unchangedAfter).toBe(unchangedBefore);
  });

  it("does not put review markers into public prose", () => {
    for (const text of Object.values(reviewOverlay.corrections)) {
      expect(text).not.toMatch(/(?:проверено|не проверено|verified|unverified)/iu);
    }
  });

  it("keeps the source-confirmed Su Tong birth date", () => {
    expect(writerByKey(countries, "china:su_tong")?.birthDate).toBe(
      "1963-01-23"
    );
  });
});
