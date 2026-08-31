import { describe, expect, it } from "vitest";

import {
  normalizeBiographyText,
  selectWriterBiography,
  writerBiographyText,
  writerBiographyQualityIssues,
} from "../writerBiography";
import { countries } from "./index";
import type { WriterBiographyTranslationProfile } from "./types";
import englishOverlay from "./generated/writerBiographyEnglishTranslations.generated.json";
import {
  buildWriterBiographyEnglishTranslation,
  writerBiographyEnglishTranslationCount,
} from "./writerBiographyEnglishTranslations";

const russian: WriterBiographyTranslationProfile = {
  locale: "ru",
  text: "Атик Рахими - афганский писатель и режиссёр, работающий с темами войны, памяти и человеческого достоинства. Его романы получили международное признание.",
  sourceLanguage: "ru",
  status: "verified",
  method: "editorial-original",
  reviewedAt: "2026-08-31",
  reviewer: "Editorial factual review",
  sources: [
    {
      provider: "Authority source",
      url: "https://example.org/atiq-rahimi",
      fields: ["biography-facts"],
      usage: "fact-check",
      retrievedAt: "2026-08-31",
    },
  ],
};

describe("generated writer biography English translations", () => {
  it("builds a strict reviewed RU-to-EN profile with inherited provenance", () => {
    const english = buildWriterBiographyEnglishTranslation(
      {
        text: "Atiq Rahimi is an Afghan writer and director whose work examines war, memory and human dignity. His novels have received international recognition.",
        sourceHash: "a".repeat(64),
        generatedAt: "2026-08-31T12:00:00.000Z",
        reviewedAt: "2026-08-31",
        model: "@cf/google/gemma-4-26b-a4b-it",
        reviewerModel: "@cf/openai/gpt-oss-120b",
        editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
        editorialPostEditor: "Codex bilingual editorial QA",
        editorialPostEditReasonCodes: ["english-style-polish"],
      },
      russian
    );

    expect(english).toMatchObject({
      locale: "en",
      status: "reviewed",
      method: "machine-translation",
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
      reviewedAt: "2026-08-31",
      reviewer:
        "Cloudflare Workers AI two-pass review: @cf/google/gemma-4-26b-a4b-it + @cf/openai/gpt-oss-120b; editorial post-edit: Codex bilingual editorial QA",
      translationMeta: {
        model: "@cf/google/gemma-4-26b-a4b-it",
        reviewerModel: "@cf/openai/gpt-oss-120b",
        sourceHash: "a".repeat(64),
        editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
        editorialPostEditor: "Codex bilingual editorial QA",
        editorialPostEditReasonCodes: ["english-style-polish"],
      },
    });
    expect(english.sources).toEqual(russian.sources);
    expect(english.sources).not.toBe(russian.sources);
    expect(
      writerBiographyQualityIssues(english, "en", {
        id: "atiq_rahimi",
        biographyTranslations: { ru: russian, en: english },
      })
    ).toEqual([]);
  });

  it("publishes all 1684 Russian biographies under an explicit paused or complete EN contract", () => {
    const writers = countries.flatMap((country) =>
      country.writers.map((writer) => ({ country, writer }))
    );
    expect(writers).toHaveLength(1_684);
    expect(writerBiographyEnglishTranslationCount).toBe(
      englishOverlay.translatedCount
    );
    expect(Object.keys(englishOverlay.translations)).toHaveLength(
      englishOverlay.translatedCount
    );
    expect([0, 1_684]).toContain(englishOverlay.translatedCount);

    const normalizedEnglish = new Map<string, string>();
    let publishedEnglishCount = 0;
    for (const { country, writer } of writers) {
      const key = `${country.id}:${writer.id}`;
      const russian = selectWriterBiography(writer, "ru");
      const english = selectWriterBiography(writer, "en");
      expect(russian, `${key}: strict Russian source`).not.toBeNull();

      if (englishOverlay.translatedCount === 1_684) {
        expect(english, `${key}: strict English translation`).not.toBeNull();
        expect(english, key).toMatchObject({
          locale: "en",
          status: "reviewed",
          method: "machine-translation",
          translatedFromLocale: "ru",
          sourceTextRights: "project-original",
          translationMeta: {
            model: "@cf/google/gemma-4-26b-a4b-it",
            reviewerModel: "@cf/openai/gpt-oss-120b",
          },
        });
        expect(english?.translationMeta?.sourceHash, key).toMatch(
          /^[a-f0-9]{64}$/u
        );
        expect(english?.translationMeta?.generatedAt, key).toBeTruthy();
        expect(english?.sources, key).toEqual(russian?.sources);
      }

      if (!english) {
        expect(
          writerBiographyText(writer, "en"),
          `${key}: no RU fallback`
        ).toBeNull();
        continue;
      }

      publishedEnglishCount += 1;
      if (englishOverlay.translatedCount === 0) {
        expect(english, key).toMatchObject({
          locale: "en",
          status: "reviewed",
          method: "editorial-original",
        });
      }
      expect(
        writerBiographyQualityIssues(english, "en", writer),
        key
      ).toEqual([]);
      expect(english.text, `${key}: English must not contain Cyrillic`).not.toMatch(
        /\p{Script=Cyrillic}/u
      );
      expect(
        normalizeBiographyText(english.text),
        `${key}: English must not reuse the Russian text`
      ).not.toBe(normalizeBiographyText(russian?.text || ""));

      const normalized = normalizeBiographyText(
        english.text
      ).toLocaleLowerCase("en");
      expect(
        normalizedEnglish.has(normalized),
        `${key}: duplicate of ${normalizedEnglish.get(normalized) || "unknown"}`
      ).toBe(false);
      normalizedEnglish.set(normalized, key);
    }

    if (englishOverlay.translatedCount === 0) {
      expect(englishOverlay.translations).toEqual({});
      expect(publishedEnglishCount).toBe(20);
      expect(normalizedEnglish.size).toBe(20);
    } else {
      expect(publishedEnglishCount).toBe(1_684);
      expect(normalizedEnglish.size).toBe(1_684);
    }
  });
});
