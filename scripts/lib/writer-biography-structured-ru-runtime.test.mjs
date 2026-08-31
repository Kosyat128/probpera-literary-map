import { describe, expect, it } from "vitest";

import {
  selectWriterBiography,
  writerBiographyQualityIssues,
} from "../../src/data/writerBiography.ts";
import { countries } from "../../src/data/countries/index.ts";
import reviewOverlay from "../../src/data/countries/generated/writerBiographyFactReviewCorrections.generated.json";
import { russianWriterExpansion } from "../../src/data/countries/russianWriterExpansion.ts";
import {
  isStructuredRussianBiographyText,
  normalizeStructuredRussianBiographyText,
  structuredRussianBiographySourceNarrationPattern,
  structuredRussianBiographyTautologyIssues,
  structuredRussianBiographyTechnicalPattern,
} from "./writer-biography-structured-ru.mjs";

const russianInstitutionalHost =
  /(?:^|\.)(?:bigenc|prlib|culture|nlr|rsl|imli|pushkinmuseum|museum-xxvek|rgakfd|rusneb|ras|ruslang|pushkinskijdom|goslitmuz|bulgakovmuseum|museum-esenin|museumpushkin|pravenc|kraslib|sholokhov|solzhenitsyn|tolstoymuseum|dommuseum|turgenevmus)\.ru$|(?:^|\.)md\.spb\.ru$|(?:^|\.)chekhovmuseum\.com$/iu;

describe("public structured Russian biography corpus", () => {
  it("publishes all 1684 writers through the strict provenance gate", () => {
    const writers = countries.flatMap((country) =>
      country.writers.map((writer) => ({ countryId: country.id, writer }))
    );
    expect(writers).toHaveLength(1684);
    expect(
      Object.keys(reviewOverlay.structuredRussianBiographies || {})
    ).toHaveLength(1672);
    expect(russianWriterExpansion).toHaveLength(12);

    const normalizedTexts = new Map();
    for (const { countryId, writer } of writers) {
      const key = `${countryId}:${writer.id}`;
      expect(
        writerBiographyQualityIssues(
          writer.biographyTranslations?.ru,
          "ru",
          writer
        ),
        key
      ).toEqual([]);
      const translation = selectWriterBiography(writer, "ru");
      expect(translation, key).not.toBeNull();
      expect(translation.text, key).toBe(writer.bio);
      expect(isStructuredRussianBiographyText(translation.text), key).toBe(
        true
      );
      expect(
        structuredRussianBiographySourceNarrationPattern.test(translation.text),
        key
      ).toBe(false);
      expect(
        structuredRussianBiographyTechnicalPattern.test(translation.text),
        key
      ).toBe(false);
      expect(
        structuredRussianBiographyTautologyIssues(translation.text),
        key
      ).toHaveLength(0);
      expect(translation.locale, key).toBe("ru");
      expect(translation.sourceLanguage, key).toBe("ru");
      expect(translation.status, key).toBe("verified");
      expect(translation.method, key).toBe("editorial-original");
      expect(translation.sourceTextRights, key).toBe("project-original");
      expect(translation.reviewedAt, key).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(translation.reviewer?.trim(), key).toBeTruthy();
      if (countryId === "russia") {
        expect(translation.sources, key).toHaveLength(1);
      } else {
        expect(translation.sources.length, key).toBeGreaterThanOrEqual(2);
      }
      const hostnames = new Set();
      for (const source of translation.sources) {
        expect(source.url, key).toMatch(/^https:\/\//u);
        expect(source.provider.trim(), key).toBeTruthy();
        expect(source.usage, key).toBe("fact-check");
        expect(source.fields, key).toContain("biography-facts");
        expect(source.retrievedAt, key).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        hostnames.add(new URL(source.url).hostname.toLowerCase());
      }
      if (countryId === "russia") {
        expect(hostnames.size, key).toBe(1);
      } else {
        expect(hostnames.size, key).toBeGreaterThanOrEqual(2);
      }

      const normalized = normalizeStructuredRussianBiographyText(
        translation.text
      ).toLocaleLowerCase("ru");
      expect(normalizedTexts.get(normalized), key).toBeUndefined();
      normalizedTexts.set(normalized, key);
    }
  }, 30_000);

  it("keeps an authoritative Russian institutional source first for Russian writers", () => {
    const russianCountry = countries.find((country) => country.id === "russia");
    expect(russianCountry?.writers).toHaveLength(53);
    for (const writer of russianCountry?.writers || []) {
      const translation = selectWriterBiography(writer, "ru");
      expect(translation.sources, writer.id).toHaveLength(1);
      expect(
        new URL(translation.sources[0].url).hostname.toLowerCase(),
        writer.id
      ).not.toBe("old.bigenc.ru");
      expect(
        new URL(translation.sources[0].url).hostname,
        writer.id
      ).toMatch(russianInstitutionalHost);
    }
  });

  it("never selects deprecated generic BРЭ redirects as Russian primary evidence", () => {
    const expectedPrimarySources = {
      nestor: "https://www.pravenc.ru/text/2565114.html",
      "kirill-turovsky": "https://www.pravenc.ru/text/1840435.html",
      sergey_ivanovich_ozhegov:
        "https://vja.ruslang.ru/ru/archive/2000-5/81-92",
    };
    const russianCountry = countries.find((country) => country.id === "russia");
    for (const [writerId, expectedUrl] of Object.entries(
      expectedPrimarySources
    )) {
      const writer = russianCountry?.writers.find(
        (candidate) => candidate.id === writerId
      );
      expect(selectWriterBiography(writer, "ru").sources[0].url, writerId).toBe(
        expectedUrl
      );
    }
  });

  it("labels two-pass AI editorial provenance without presenting it as manual review", () => {
    for (const [key, publication] of Object.entries(
      reviewOverlay.structuredRussianBiographies || {}
    )) {
      if (publication.derivation !== "two-pass-editorial-refinement") continue;
      const [countryId, writerId] = key.split(":");
      const writer = countries
        .find((country) => country.id === countryId)
        ?.writers.find((candidate) => candidate.id === writerId);
      const translation = selectWriterBiography(writer, "ru");
      expect(translation.reviewer, key).toMatch(/Workers AI/iu);
      expect(translation.translationMeta?.model, key).toBe(
        publication.translatorModel
      );
      expect(translation.translationMeta?.reviewerModel, key).toBe(
        publication.reviewerModel
      );
      expect(translation.translationMeta?.generatedAt, key).toBe(
        publication.generatedAt
      );
    }
  });

  it("labels locally curated prose separately from factual review", () => {
    const curated = Object.entries(
      reviewOverlay.structuredRussianBiographies || {}
    ).filter(([, publication]) => publication.derivation === "curated-editorial");
    expect(curated).toHaveLength(316);

    for (const [key, publication] of curated) {
      expect(publication.reviewer, key).toMatch(
        /^Редакционная обработка Codex; факты проверены: /u
      );
      expect(publication.factualReviewer.trim(), key).toBeTruthy();
      expect(publication.reviewer, key).not.toMatch(/Workers AI/iu);
    }
  });
});
