import { describe, expect, it } from "vitest";

import {
  writerBiographyEnglishSourceFingerprint,
  writerBiographyEnglishSourceHash,
  writerBiographyRussianSourceIssues,
} from "./writer-biography-english-source-contract.mjs";

const record = {
  key: "afghanistan:atiq_rahimi",
  writerName: "Atiq Rahimi",
  russian: {
    locale: "ru",
    text: "Атик Рахими - афганский писатель и режиссёр, чьи произведения обращаются к войне, памяти и человеческому достоинству. Его романы получили международное признание.",
    sourceLanguage: "ru",
    status: "verified",
    method: "editorial-original",
    reviewedAt: "2026-08-31",
    reviewer: "Editorial factual review",
    sourceTextRights: "project-original",
    sources: [
      {
        provider: "Authority source",
        url: "https://example.org/atiq-rahimi",
        usage: "fact-check",
        fields: ["biography-facts"],
        retrievedAt: "2026-08-31",
      },
    ],
    translationMeta: {
      sourceHash: "sha256:source",
      generatedAt: "2026-08-31",
    },
  },
};

describe("English biography verified-Russian source contract", () => {
  it("accepts only a fully verified project-original RU profile", () => {
    expect(writerBiographyRussianSourceIssues(record)).toEqual([]);

    const reviewed = structuredClone(record);
    reviewed.russian.status = "reviewed";
    expect(writerBiographyRussianSourceIssues(reviewed)).toContain(
      "russian-is-not-verified"
    );

    const invalidRights = structuredClone(record);
    invalidRights.russian.sourceTextRights = "licensed";
    expect(writerBiographyRussianSourceIssues(invalidRights)).toContain(
      "russian-source-rights-mismatch"
    );

    const invalidSource = structuredClone(record);
    invalidSource.russian.sources[0].url = "http://example.org/atiq-rahimi";
    expect(writerBiographyRussianSourceIssues(invalidSource)).toContain(
      "russian-source-provenance-invalid"
    );
  });

  it("changes the per-key SHA when exact RU text or provenance changes", () => {
    const baseline = writerBiographyEnglishSourceHash(record);
    for (const mutate of [
      (candidate) => {
        candidate.key = "afghanistan:other";
      },
      (candidate) => {
        candidate.russian.text += " Дополнение.";
      },
      (candidate) => {
        candidate.russian.reviewer = "Another reviewer";
      },
      (candidate) => {
        candidate.russian.sources[0].url = "https://example.org/other";
      },
      (candidate) => {
        candidate.russian.translationMeta.generatedAt = "2026-09-01";
      },
    ]) {
      const candidate = structuredClone(record);
      mutate(candidate);
      expect(writerBiographyEnglishSourceHash(candidate)).not.toBe(baseline);
    }

    expect(baseline).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      writerBiographyEnglishSourceFingerprint([
        { ...record, sourceHash: baseline },
      ])
    ).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });
});
