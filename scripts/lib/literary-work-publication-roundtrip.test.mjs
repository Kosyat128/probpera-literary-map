import { describe, expect, it } from "vitest";

import {
  groupPublishedWorkRows,
  publishedWorkMetadata,
  publishedWorkSources,
  publishedWorkTranslations,
} from "./literary-work-publication-roundtrip.mjs";

describe("published literary-work metadata round-trip", () => {
  it("keeps source jurisdiction and publication market as separate fields", () => {
    const sources = publishedWorkSources(
      "work-1",
      groupPublishedWorkRows([{
        work_id: "work-1",
        provider: "National bibliography",
        source_url: "https://catalog.example/work-1",
        field_names: ["identity", "title", "market"],
        license_name: null,
        usage: "reference-only",
        retrieved_at: "2026-09-02",
        metadata: {
          authorityId: "example-nb",
          authorityTier: "A",
          country: "CZ",
          market: "US",
          language: "en",
          recordKind: "legal-deposit-catalog",
          recordId: "record-1",
        },
      }])
    );

    expect(sources).toEqual([{
      provider: "National bibliography",
      authorityId: "example-nb",
      authorityTier: "A",
      country: "CZ",
      market: "US",
      language: "en",
      recordKind: "legal-deposit-catalog",
      recordId: "record-1",
      url: "https://catalog.example/work-1",
      fields: ["identity", "title", "market"],
      usage: "reference-only",
      retrievedAt: "2026-09-02",
    }]);
  });

  it("restores translation evidence and work-level enrichment metadata", () => {
    const titleEvidence = {
      entityKind: "expression",
      expressionId: "work-1:ru",
      locale: "ru",
      value: "Название",
      status: "verified-published",
      expressionLanguage: "Russian",
      market: "RU",
      selectionRule: "authoritative-uniform-title",
      evidence: [],
    };
    const descriptionProvenance = {
      origin: "official-source-synthesis",
      sourceLanguage: "Russian",
      sourceCountry: "RU",
      sourceUrls: ["https://catalog.example/work-1"],
      rights: { textOrigin: "project-original", copiedSourceText: false },
      author: "Editor",
      createdAt: "2026-09-02",
      reviewedBy: "Reviewer",
      reviewedAt: "2026-09-02",
    };
    const translations = publishedWorkTranslations(
      "work-1",
      groupPublishedWorkRows([{
        work_id: "work-1",
        locale: "ru",
        title: "Название",
        description: "Проверенное описание произведения.",
        source_language: "Russian",
        translation_method: "editorial-original",
        editorial_status: "verified",
        source_urls: ["https://catalog.example/work-1"],
        reviewed_at: "2026-09-02",
        metadata: { titleEvidence, descriptionProvenance },
      }])
    );
    expect(translations?.ru?.titleEvidence).toEqual(titleEvidence);
    expect(translations?.ru?.descriptionProvenance).toEqual(
      descriptionProvenance
    );

    const metadata = publishedWorkMetadata({
      localizedTitles: { ru: titleEvidence },
      canon: { status: "canonical-classic", evidence: [] },
      unrelatedLegacyMetadata: "not-public",
    });
    expect(metadata).toEqual({
      localizedTitles: { ru: titleEvidence },
      canon: { status: "canonical-classic", evidence: [] },
    });
  });

  it("omits absent optional enrichment rather than inventing it", () => {
    expect(publishedWorkTranslations("missing", new Map())).toBeUndefined();
    expect(publishedWorkSources("missing", new Map())).toBeUndefined();
    expect(publishedWorkMetadata(null)).toEqual({});
  });
});
