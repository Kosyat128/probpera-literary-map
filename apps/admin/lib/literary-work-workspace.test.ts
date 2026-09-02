import { describe, expect, it } from "vitest";

import {
  parseWorkExternalId,
  parseWorkImportCandidateReview,
  parseWorkSourceEdit,
  parseWorkTranslationEdit,
} from "./literary-work-workspace";

const workId = "11111111-1111-4111-8111-111111111111";
const rowId = "22222222-2222-4222-8222-222222222222";
const version = "2026-08-13T12:00:00.000Z";

describe("literary work workspace validation", () => {
  it("accepts a source-aware reviewed translation", () => {
    const parsed = parseWorkTranslationEdit({
      workId,
      translationId: rowId,
      expectedUpdatedAt: version,
      locale: "ru",
      title: "Название",
      description:
        "Это достаточно подробное редакционное описание произведения, которое раскрывает его основной сюжет и исторический контекст. Второе предложение фиксирует литературное значение текста и остаётся проверяемым по указанным источникам.",
      sourceLanguage: "ru",
      translationMethod: "editorial-original",
      editorialStatus: "reviewed",
      sourceUrls: "https://example.org/catalogue\nhttps://example.org/catalogue",
      reviewedAt: "2026-08-13",
    });

    expect(parsed.patch.source_urls).toEqual(["https://example.org/catalogue"]);
    expect(parsed.expectedUpdatedAt).toBe(version);
  });

  it("blocks publishing an unsourced or one-sentence translation", () => {
    expect(() =>
      parseWorkTranslationEdit({
        workId,
        locale: "en",
        title: "Title",
        description: "A".repeat(150),
        sourceLanguage: "en",
        translationMethod: "human-translation",
        editorialStatus: "verified",
        sourceUrls: "",
        reviewedAt: "",
      })
    ).toThrow(/источник|строк/iu);
  });

  it("blocks objective prose defects before they reach the database", () => {
    expect(() =>
      parseWorkTranslationEdit({
        workId,
        locale: "ru",
        title: "Название",
        description:
          "Это достаточно длинное описание  с ошибочным пробелом и URL https://example.org внутри текста. Второе предложение завершает проверочный пример без добавления полезных фактов.",
        sourceLanguage: "ru",
        translationMethod: "editorial-original",
        editorialStatus: "draft",
        sourceUrls: "",
        reviewedAt: "",
      })
    ).toThrow(/пробел|URL/iu);
  });

  it("normalizes source fields and validates HTTPS", () => {
    const parsed = parseWorkSourceEdit({
      workId,
      provider: "National Library",
      sourceUrl: "https://example.org/work",
      fieldNames: "title\ntitle\ndescription",
      licenseName: "CC0",
      usage: "structured-data",
      retrievedAt: "2026-08-13",
    });
    expect(parsed.patch.field_names).toEqual(["title", "description"]);
    expect(() => parseWorkSourceEdit({
      workId,
      provider: "Library",
      sourceUrl: "http://example.org/work",
      fieldNames: "title",
      usage: "reference-only",
      retrievedAt: "2026-08-13",
    })).toThrow(/HTTPS/iu);
  });

  it("accepts allowlisted external identifiers", () => {
    expect(parseWorkExternalId({
      workId,
      scheme: "OpenLibrary",
      externalId: "OL123W",
      sourceUrl: "https://openlibrary.org/works/OL123W",
    }).scheme).toBe("openlibrary");
  });

  it("requires a reason for rejected import candidates", () => {
    expect(() => parseWorkImportCandidateReview({
      candidateId: rowId,
      workId,
      expectedUpdatedAt: version,
      qualityScore: 70,
      status: "rejected",
      rejectionReasons: "",
    })).toThrow(/причин|строк/iu);
  });
});
