import { describe, expect, it } from "vitest";

import {
  normalizeArticlePublicMetadata,
  normalizePublicMetadataText,
} from "./article-route-policy.mjs";

describe("public article metadata normalization", () => {
  it("resolves nested whitespace entities in one stable call", () => {
    const normalized = normalizePublicMetadataText(
      "Глава&amp;nbsp;\u00a0\t\nназвание"
    );

    expect(normalized).toBe("Глава название");
    expect(normalizePublicMetadataText(normalized)).toBe(normalized);
  });

  it("normalizes root and English metadata to the same fixed point", () => {
    const normalized = normalizeArticlePublicMetadata({
      title: "Русский&amp;#160;\nзаголовок",
      translations: {
        en: {
          title: "English&amp;nbsp;\t title",
        },
      },
    });

    expect(normalized.title).toBe("Русский заголовок");
    expect(normalized.translations.en.title).toBe("English title");
    expect(normalizeArticlePublicMetadata(normalized)).toEqual(normalized);
  });
});
