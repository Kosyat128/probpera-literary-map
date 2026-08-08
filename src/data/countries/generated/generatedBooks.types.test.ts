import { describe, expect, it } from "vitest";

import type { ReviewedBooksPayload } from "./generatedBooks";

const nonEmptyReviewedPayloadFixture = {
  generatedAt: "2026-08-08T00:00:00.000Z",
  sourceManifestFingerprint: "fixture",
  source: "compile-time reviewed payload fixture",
  works: {
    "england:writer": [
      {
        id: "reviewed-work",
        title: "Проверенная книга",
        translations: {
          ru: {
            locale: "ru",
            title: "Проверенная книга",
            description:
              "Первое предложение описывает конкретный конфликт произведения и его участников. Второе предложение показывает развитие этого конфликта и его последствия для героев.",
            sourceLanguage: "ru",
            status: "reviewed",
            sourceUrls: ["https://example.org/work"],
            method: "editorial-original",
            reviewedAt: "2026-08-08",
          },
          en: {
            locale: "en",
            title: "A Reviewed Book",
            description:
              "The first sentence describes a specific conflict and the people involved in it. The second sentence explains how that conflict develops and changes the characters.",
            sourceLanguage: "en",
            status: "reviewed",
            sourceUrls: ["https://example.org/work"],
            method: "editorial-original",
            reviewedAt: "2026-08-08",
          },
        },
        sources: [
          {
            provider: "Example authority",
            url: "https://example.org/work",
            fields: ["identity", "authorship", "language"],
            usage: "reference-only",
            retrievedAt: "2026-08-08",
          },
        ],
        editorial: { status: "reviewed", reviewedAt: "2026-08-08" },
      },
    ],
  },
} satisfies ReviewedBooksPayload;

describe("reviewed generated books payload type", () => {
  it("accepts a non-empty bilingual reviewed WorkProfile payload", () => {
    expect(nonEmptyReviewedPayloadFixture.works["england:writer"]).toHaveLength(1);
  });
});
