import { describe, expect, it } from "vitest";

import {
  normalizeBiographyText,
  selectWriterBiography,
  writerBiographyText,
  writerBiographyQualityIssues,
} from "../writerBiography";
import { countries } from "./index";
import type { Country, WriterBiographyTranslationProfile } from "./types";
import englishOverlay from "./generated/writerBiographyEnglishTranslations.generated.json";
import {
  buildWriterBiographyEnglishTranslation,
  mergeWriterBiographyEnglishTranslations,
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
  sources: [{
    provider: "Authority source",
    url: "https://example.org/atiq-rahimi",
    fields: ["biography-facts"],
    usage: "fact-check",
    retrievedAt: "2026-08-31",
  }],
};

const generated = {
  text: "Atiq Rahimi is an Afghan writer and director whose work examines war, memory and human dignity. His novels have received international recognition.",
  sourceHash: "a".repeat(64),
  generatedAt: "2026-08-31T12:00:00.000Z",
  reviewedAt: "2026-08-31",
  model: "synthetic-translator-model",
  reviewerModel: "synthetic-reviewer-model",
};

function fixtureCountries(english?: WriterBiographyTranslationProfile): Country[] {
  return [{
    ...countries[0]!,
    id: "fixture-country",
    writers: [{
      id: "fixture-writer",
      name: "Fixture writer",
      biographyTranslations: { ru: russian, ...(english ? { en: english } : {}) },
    }],
  }];
}

describe("generated writer biography English translations", () => {
  it.each([false, true])("keeps generated English draft with post-edit present: %s", (postEdited) => {
    const english = buildWriterBiographyEnglishTranslation({
      ...generated,
      ...(postEdited ? {
        editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
        editorialPostEditor: "Automated bilingual editorial QA",
        editorialPostEditReasonCodes: ["english-style-polish"],
      } : {}),
    }, russian);

    expect(english).toMatchObject({
      locale: "en",
      status: "draft",
      method: "machine-translation",
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
      translationMeta: {
        model: generated.model,
        reviewerModel: generated.reviewerModel,
        sourceHash: generated.sourceHash,
        generatedAt: generated.generatedAt,
      },
    });
    expect(english.reviewedAt).toBeUndefined();
    expect(english.reviewer).toBeUndefined();
    expect(english.editorialReview).toBeUndefined();
    expect(english.sources).toEqual(russian.sources);
    expect(english.sources).not.toBe(russian.sources);
    expect(english.sources[0]!.fields).not.toBe(russian.sources[0]!.fields);
    if (postEdited) {
      expect(english.translationMeta).toMatchObject({
        editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
        editorialPostEditor: "Automated bilingual editorial QA",
        editorialPostEditReasonCodes: ["english-style-polish"],
      });
    }
    const candidate = fixtureCountries(english)[0]!.writers[0]!;
    expect(writerBiographyQualityIssues(english, "en", candidate)).toContain("missing-review");
    expect(selectWriterBiography(candidate, "en")).toBeNull();
  });

  it("does not trust approval fields attached to generated input", () => {
    // Deliberately untrusted synthetic fields: generation cannot accept a review.
    const candidate = {
      ...generated,
      status: "reviewed",
      reviewer: "Claimed reviewer",
      editorialReview: { decision: "approved", reviewer: "Claimed reviewer" },
    };
    const english = buildWriterBiographyEnglishTranslation(candidate, russian);
    expect(english.status).toBe("draft");
    expect(english.editorialReview).toBeUndefined();
    expect(english.reviewer).toBeUndefined();
    expect(english.reviewedAt).toBeUndefined();
  });

  it("preserves an existing valid authored English profile when a generated draft exists", () => {
    const authored: WriterBiographyTranslationProfile = {
      ...russian,
      locale: "en",
      text: generated.text,
      sourceLanguage: "en",
      status: "reviewed",
      method: "editorial-original",
    };
    const original = fixtureCountries(authored);
    const merged = mergeWriterBiographyEnglishTranslations(original, new Map([
      ["fixture-country:fixture-writer", generated],
    ]));
    expect(merged[0]!.writers[0]).toBe(original[0]!.writers[0]);
    expect(selectWriterBiography(merged[0]!.writers[0]!, "en")).toBe(authored);
  });

  it("retains an unpublished generated draft without exposing it or falling back to RU in EN", () => {
    const original = fixtureCountries();
    const merged = mergeWriterBiographyEnglishTranslations(original, new Map([
      ["fixture-country:fixture-writer", generated],
    ]));
    const candidate = merged[0]!.writers[0]!;
    expect(candidate.biographyTranslations!.en!.status).toBe("draft");
    expect(candidate.biographyTranslations!.ru).toBe(russian);
    expect(writerBiographyText(candidate, "en")).toBeNull();
    expect(original[0]!.writers[0]!.biographyTranslations!.en).toBeUndefined();
    expect(mergeWriterBiographyEnglishTranslations(original, new Map())).toBe(original);
  });

  it.each(["draft", "stale"] as const)("preserves an existing human %s and its correction evidence instead of overwriting it with generated text", (status) => {
    const pending: WriterBiographyTranslationProfile = {
      ...russian,
      locale: "en",
      text: "This synthetic pending translation belongs to a correction queue and must retain its existing text and evidence. An automatic overlay cannot replace the editor's unfinished work.",
      sourceLanguage: "ru",
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
      status,
      method: "human-translation",
      // Deliberately synthetic retained evidence; this is not a real approval.
      editorialReview: {
        schemaVersion: 1,
        hashContract: "writer-biography-review-v1",
        decision: "withdrawn",
        reviewerType: "human",
        reviewer: "Synthetic fixture reviewer",
        reviewedAt: "2026-09-08",
        evidenceRef: "https://example.org/test-only/retained-correction",
        sourceHash: "a".repeat(64),
        targetHash: "b".repeat(64),
      },
    };
    const original = fixtureCountries(pending);
    const merged = mergeWriterBiographyEnglishTranslations(original, new Map([
      ["fixture-country:fixture-writer", generated],
    ]));
    expect(merged[0]!.writers[0]).toBe(original[0]!.writers[0]);
    expect(merged[0]!.writers[0]!.biographyTranslations!.en).toBe(pending);
    expect(selectWriterBiography(merged[0]!.writers[0]!, "en")).toBeNull();
  });

  it("preserves the current 1684 published RU profiles and 20 authored EN profiles without auto-approving generated output", () => {
    const writers = countries.flatMap((country) =>
      country.writers.map((writer) => ({ country, writer }))
    );
    expect(writers).toHaveLength(1_684);
    expect(writerBiographyEnglishTranslationCount).toBe(englishOverlay.translatedCount);
    expect(Object.keys(englishOverlay.translations)).toHaveLength(englishOverlay.translatedCount);
    // Current corpus checkpoint: future generated rows do not become approvals.
    expect(englishOverlay.translatedCount).toBe(0);

    const normalizedEnglish = new Map<string, string>();
    let publishedEnglishCount = 0;
    for (const { country, writer } of writers) {
      const key = `${country.id}:${writer.id}`;
      const russianProfile = selectWriterBiography(writer, "ru");
      const english = selectWriterBiography(writer, "en");
      expect(russianProfile, `${key}: strict Russian source`).not.toBeNull();
      if (!english) {
        expect(writerBiographyText(writer, "en"), `${key}: no RU fallback`).toBeNull();
        continue;
      }

      publishedEnglishCount += 1;
      expect(english, key).toMatchObject({
        locale: "en",
        status: "reviewed",
        method: "editorial-original",
      });
      expect(writerBiographyQualityIssues(english, "en", writer), key).toEqual([]);
      expect(english.text, `${key}: English must not contain Cyrillic`).not.toMatch(/\p{Script=Cyrillic}/u);
      expect(normalizeBiographyText(english.text), `${key}: no reused RU text`).not.toBe(normalizeBiographyText(russianProfile?.text || ""));
      const normalized = normalizeBiographyText(english.text).toLocaleLowerCase("en");
      expect(normalizedEnglish.has(normalized), `${key}: duplicate of ${normalizedEnglish.get(normalized) || "unknown"}`).toBe(false);
      normalizedEnglish.set(normalized, key);
    }
    expect(publishedEnglishCount).toBe(20);
    expect(normalizedEnglish.size).toBe(20);
  });
});
