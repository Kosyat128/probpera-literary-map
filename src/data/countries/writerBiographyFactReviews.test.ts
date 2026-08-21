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
      reviewed: 1200,
      corrected: 1057,
    });
    expect(Object.keys(reviewOverlay.corrections)).toHaveLength(1057);
    expect(reviewRollup.summary).toEqual({
      records: 1200,
      unchanged: 88,
      corrected: 1057,
      held: 55,
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

  it("never publishes held batch 29 identities or correction text", () => {
    const heldKeys = [
      "gabon:florentin_moussavou_nzigu",
      "gabon:juste_auguste_kotto",
      "gambia:baaba_jobarteh",
    ];
    const publicKeys = new Set(
      countries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );

    for (const heldKey of heldKeys) {
      expect(reviewOverlay.corrections).not.toHaveProperty(heldKey);
      expect(publicKeys.has(heldKey)).toBe(false);
    }
  });

  it("publishes corrected batch 30 associations and withholds only Julian Fedon", () => {
    const publicKeys = new Set(
      countries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );

    expect(reviewOverlay.corrections).not.toHaveProperty(
      "grenada:julian_fedon"
    );
    expect(publicKeys.has("grenada:julian_fedon")).toBe(false);
    expect(publicKeys.has("germany:robert_musil")).toBe(true);
    expect(publicKeys.has("germany:stefan_zweig")).toBe(true);
    expect(reviewOverlay.corrections).toHaveProperty("germany:robert_musil");
    expect(reviewOverlay.corrections).toHaveProperty("germany:stefan_zweig");
  });

  it("keeps the source-confirmed Su Tong birth date", () => {
    expect(writerByKey(countries, "china:su_tong")?.birthDate).toBe(
      "1963-01-23"
    );
  });
});
