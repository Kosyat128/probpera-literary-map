import { describe, expect, it } from "vitest";

import { buildReviewedWork, reviewedPayload } from "./book-enrichment-promotion.mjs";
import { curatedRecordIssues } from "./book-enrichment-policy.mjs";

const sourceRecord = {
  countryId: "england",
  writerId: "writer",
  id: "openlibrary-works-ol1w",
  title: "Source title",
  externalIdentities: ["openlibrary:OL1W"],
};
const curatedRecord = {
  canonical: {
    titleRu: "Русское название",
    titleEn: "English title",
    originalTitle: "Original title",
    firstPublished: 1945,
    originalLanguage: "английский",
    genres: ["роман"],
  },
  annotationRu: {
    text: "Герой сталкивается с нравственным выбором, который меняет его отношения с близкими и заставляет по-новому увидеть прошлое. Роман последовательно раскрывает цену этого решения через конкретный конфликт, развитие характеров и последствия совершённых поступков.",
    method: "editorial-original",
    author: "Book editor",
    createdAt: "2026-08-07",
    reviewedBy: "Independent reviewer",
    reviewedAt: "2026-08-08",
  },
  annotationEn: {
    text: "The first English sentence describes the work through a concrete decision that changes the protagonist's relationships and sense of responsibility. The second sentence identifies the structure of the conflict and its consequences without substituting generic praise for the plot.",
    method: "editorial-original",
    author: "Book editor",
    createdAt: "2026-08-07",
    reviewedBy: "Independent reviewer",
    reviewedAt: "2026-08-08",
  },
  sources: [
    {
      provider: "Wikidata",
      url: "https://www.wikidata.org/wiki/Q1",
      usage: "structured-data",
      fields: ["identity", "title"],
      license: "CC0 1.0",
      retrievedAt: "2026-08-08",
      textReuse: "none",
    },
    {
      provider: "Open Library",
      url: "https://openlibrary.org/works/OL1W",
      usage: "reference-only",
      fields: ["identity", "authorship", "publication-year", "language"],
      retrievedAt: "2026-08-08",
      textReuse: "none",
    },
  ],
  factChecks: [
    "identity",
    "authorship",
    "publication-year",
    "original-language",
  ].map((field) => ({
    field,
    value: "checked",
    sourceUrls: [
      "https://www.wikidata.org/wiki/Q1",
      "https://openlibrary.org/works/OL1W",
    ],
    checkedAt: "2026-08-08",
  })),
  rights: {
    textOrigin: "project-original",
    copiedSourceText: false,
  },
};

describe("reviewed book promotion", () => {
  it("maps a validated bilingual curation into the existing WorkProfile shape", () => {
    const work = buildReviewedWork({ sourceRecord, curatedRecord });

    expect(work).toMatchObject({
      id: "openlibrary-works-ol1w",
      title: "Русское название",
      originalTitle: "Original title",
      editorial: { status: "reviewed", reviewedAt: "2026-08-08" },
      translations: {
        ru: { locale: "ru", status: "reviewed", method: "editorial-original" },
        en: { locale: "en", status: "reviewed", method: "editorial-original" },
      },
    });
    expect(work.externalIds).toEqual([
      {
        scheme: "openlibrary",
        value: "OL1W",
        sourceUrl: "https://openlibrary.org/works/OL1W",
      },
    ]);
  });

  it("emits only explicitly supplied zero-issue ready records", () => {
    const manifest = {
      generatedAt: "2026-08-08T00:00:00.000Z",
      datasetFingerprint: "fingerprint",
    };
    expect(curatedRecordIssues(curatedRecord)).toEqual([]);
    const payload = reviewedPayload({
      manifest,
      readyRecords: [{ sourceRecord, curatedRecord }],
    });

    expect(Object.values(payload.works).flat()).toHaveLength(1);
    expect(payload.works["england:writer"][0].editorial.status).toBe("reviewed");
  });

  it("does not infer promotions from research or rejected records", () => {
    const payload = reviewedPayload({
      manifest: {
        generatedAt: "2026-08-08T00:00:00.000Z",
        datasetFingerprint: "fingerprint",
      },
      readyRecords: [],
    });

    expect(payload.works).toEqual({});
  });

  it("refuses an explicitly supplied record when quality validation has issues", () => {
    const payload = reviewedPayload({
      manifest: {
        generatedAt: "2026-08-08T00:00:00.000Z",
        datasetFingerprint: "fingerprint",
      },
      readyRecords: [
        {
          sourceRecord,
          curatedRecord: { ...curatedRecord, annotationEn: null },
        },
      ],
    });

    expect(payload.works).toEqual({});
  });
});
