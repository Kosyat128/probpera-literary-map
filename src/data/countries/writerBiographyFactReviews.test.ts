import { describe, expect, it } from "vitest";

import {
  legacyWriterBiography,
  selectWriterBiography,
} from "../writerBiography";
import {
  countries,
  writerBiographyFactReviewSourceCountries,
} from "./index";
import reviewOverlay from "./generated/writerBiographyFactReviewCorrections.generated.json";
import clientReviewRuntime from "./generated/writerBiographyFactReviewRuntime.generated.json";
import {
  equivalentReviewedWorkTitle,
  writerBiographyFactReviewCounts,
} from "./writerBiographyFactReviews";
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

function normalizedWorkTitle(value: string | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

describe("writer biography fact-review overlay", () => {
  it("deduplicates inflected and parenthesized forms without merging translations", () => {
    expect(
      equivalentReviewedWorkTitle(
        "Манхэттенский трансфер",
        "Манхэттенского трансфера"
      )
    ).toBe(true);
    expect(equivalentReviewedWorkTitle("Декамерон", "Декамерона")).toBe(
      true
    );
    expect(
      equivalentReviewedWorkTitle(
        "Truyện Kiều (Повесть о Киеу)",
        "Truyện Kiều"
      )
    ).toBe(true);
    expect(equivalentReviewedWorkTitle("Pariksit", "Париксит")).toBe(false);
  });

  it("publishes only the compact proven correction set", () => {
    expect(writerBiographyFactReviewCounts).toEqual({
      reviewed: 1740,
      corrected: 1577,
      published: 1573,
      russianPublished: 41,
      structuredRussianPublished: 1672,
      structuredWorkTitlesPublished: 929,
    });
    expect(Object.keys(reviewOverlay.corrections)).toHaveLength(1573);
    expect(Object.keys(reviewOverlay.russianBiographies)).toHaveLength(41);
    expect(Object.keys(reviewOverlay.structuredRussianBiographies)).toHaveLength(
      1672
    );
    expect(reviewRollup.summary).toEqual({
      records: 1740,
      unchanged: 99,
      corrected: 1577,
      held: 64,
    });
    expect(reviewRollup.publication).toEqual({
      corrections: 1573,
      russianBiographies: 41,
      structuredRussianBiographies: 1672,
      structuredWorkTitles: 929,
      excludedQuarantinedCorrectionKeys: [
        "cape_verde:virgilio_de_lemos",
        "comoros:said_ahmed_mohamed",
        "democratic_republic_of_congo:sylvain_bemba",
        "democratic_republic_of_congo:tshibumba_kanda_matulu",
      ],
    });
    expect(clientReviewRuntime.version).toBe(1);
    expect(clientReviewRuntime.reviewVersion).toBe(reviewOverlay.version);
    expect(Object.keys(clientReviewRuntime.corrections)).toHaveLength(0);
    expect(Object.keys(clientReviewRuntime.russianBiographies)).toHaveLength(0);
    expect(Object.keys(clientReviewRuntime.biographies)).toHaveLength(1672);
  });

  it("reconstructs every public Russian profile and source from the full audited overlay", () => {
    for (const [key, publication] of Object.entries(
      reviewOverlay.structuredRussianBiographies
    )) {
      const writer = writerByKey(countries, key);
      expect(writer, key).toBeDefined();
      const translation = selectWriterBiography(writer!, "ru");
      expect(translation?.text, key).toBe(publication.text);
      expect(translation?.reviewedAt, key).toBe(publication.reviewedAt);
      expect(translation?.reviewer, key).toBe(publication.reviewer);
      expect(translation?.sourceTextRights, key).toBe("project-original");
      expect(translation?.sources, key).toEqual(
        publication.sources.map((source) => ({
          provider: source.provider,
          url: source.url,
          fields: ["biography-facts"],
          usage: "fact-check",
          retrievedAt: source.retrievedAt,
        }))
      );
      const metadataPublication = publication as typeof publication & {
        generatedAt?: string;
        translatorModel?: string;
        reviewerModel?: string;
      };
      expect(translation?.translationMeta, key).toEqual({
        sourceHash: publication.sourceHash,
        generatedAt:
          metadataPublication.generatedAt || publication.reviewedAt,
        model: metadataPublication.translatorModel,
        reviewerModel: metadataPublication.reviewerModel,
      });
    }
  });

  it("publishes every Russian writer through the strict gate with a primary Russian source", () => {
    const russianCountry = countries.find((country) => country.id === "russia");
    expect(russianCountry?.writers).toHaveLength(53);

    for (const writer of russianCountry?.writers || []) {
      const translation = selectWriterBiography(writer, "ru");
      expect(translation, writer.id).not.toBeNull();
      expect(translation?.sources, writer.id).toHaveLength(1);
      expect(translation?.sourceLanguage, writer.id).toBe("ru");
      expect(translation?.method, writer.id).toBe("editorial-original");
      expect(translation?.status, writer.id).toBe("verified");
      expect(
        new URL(translation!.sources[0]!.url).hostname,
        writer.id
      ).toMatch(
        /(?:^|\.)(?:ru|chekhovmuseum\.com)$/iu
      );
    }
  });

  it("never ships corrections for identities removed from the public corpus", () => {
    for (const key of reviewRollup.publication.excludedQuarantinedCorrectionKeys) {
      expect(reviewOverlay.corrections).not.toHaveProperty(key);
      expect(writerByKey(countries, key)).toBeUndefined();
    }
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

    expect(correctedAfter).toBe(
      reviewOverlay.structuredRussianBiographies[correctedKey].text
    );
    expect(correctedAfter).not.toBe(correctedBefore);
    expect(unchangedAfter).toBe(unchangedBefore);
  });

  it("does not put review markers into public prose", () => {
    for (const text of Object.values(reviewOverlay.corrections)) {
      expect(text).not.toMatch(/(?:проверено|не проверено|verified|unverified)/iu);
    }
    for (const biography of Object.values(
      reviewOverlay.structuredRussianBiographies
    )) {
      expect(biography.text).not.toMatch(
        /(?:проверено|не проверено|verified|unverified)/iu
      );
    }
  });

  it("appends every explicitly reviewed work title without duplicating structured metadata", () => {
    let explicitWorkTitles = 0;
    let appendedWorkTitles = 0;
    const writersWithAppendedWorks = new Set<string>();

    for (const [key, publication] of Object.entries(
      reviewOverlay.structuredRussianBiographies
    )) {
      const before = writerByKey(writerBiographyFactReviewSourceCountries, key);
      const after = writerByKey(countries, key);
      expect(before, key).toBeDefined();
      expect(after, key).toBeDefined();

      const publicationIdentities = publication.works.map(normalizedWorkTitle);
      expect(new Set(publicationIdentities).size, key).toBe(
        publication.works.length
      );
      explicitWorkTitles += publication.works.length;

      const beforeTitles = [
        ...(before?.works || []),
        ...(before?.workDetails || []).map((work) => work.title),
      ];
      const afterTitles = [
        ...(after?.works || []),
        ...(after?.workDetails || []).map((work) => work.title),
      ];

      for (const [index, identity] of publicationIdentities.entries()) {
        const title = publication.works[index]!;
        expect(
          afterTitles.some((candidate) =>
            equivalentReviewedWorkTitle(candidate, title)
          ),
          `${key}:${identity}`
        ).toBe(true);
        if (
          beforeTitles.some((candidate) =>
            equivalentReviewedWorkTitle(candidate, title)
          )
        ) {
          continue;
        }
        appendedWorkTitles += 1;
        writersWithAppendedWorks.add(key);
      }
    }

    expect(explicitWorkTitles).toBe(929);
    expect(appendedWorkTitles).toBe(305);
    expect(writersWithAppendedWorks.size).toBe(282);
  });

  it("withholds titles lacking title-specific claim evidence in an exact review queue", () => {
    expect(reviewRollup.workTitleReviewExceptions).toHaveLength(37);
    expect(reviewRollup.workTitleEvidenceAliases).toHaveLength(19);
    const unresolvedMetadata: string[] = [];
    const structuredRussianBiographies =
      reviewOverlay.structuredRussianBiographies as Record<
        string,
        { works: string[] }
      >;

    for (const exception of reviewRollup.workTitleReviewExceptions) {
      const publication = structuredRussianBiographies[exception.key];
      expect(publication, exception.key).toBeDefined();
      expect(
        publication.works.map(normalizedWorkTitle),
        exception.key
      ).not.toContain(normalizedWorkTitle(exception.title));

      const before = writerByKey(
        writerBiographyFactReviewSourceCountries,
        exception.key
      );
      const beforeStructured = new Set(
        [
          ...(before?.works || []),
          ...(before?.workDetails || []).map((work) => work.title),
        ]
          .map(normalizedWorkTitle)
          .filter(Boolean)
      );
      if (beforeStructured.has(normalizedWorkTitle(exception.title))) continue;

      const after = writerByKey(countries, exception.key);
      const afterStructured = new Set(
        [
          ...(after?.works || []),
          ...(after?.workDetails || []).map((work) => work.title),
        ]
          .map(normalizedWorkTitle)
          .filter(Boolean)
      );
      expect(
        afterStructured.has(normalizedWorkTitle(exception.title)),
        `${exception.key}:${exception.title}`
      ).toBe(false);
      unresolvedMetadata.push(`${exception.key}:${exception.title}`);
    }

    expect(unresolvedMetadata).toEqual([]);
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
