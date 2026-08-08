import { describe, expect, it } from "vitest";

import {
  articleCompensationFields,
  articleCompensationPayload,
  articleTranslationSourceHash,
  canReuseEnglishTranslationApproval,
  englishTranslationCompensationFields,
  englishTranslationCompensationPayload,
  englishTranslationReleaseIssues,
} from "./article-translations";

describe("bilingual article publication helpers", () => {
  it("creates a stable source hash independent of object key order", () => {
    const base = {
      title: "Русский оригинал",
      subtitle: "",
      excerpt: "Описание",
      contentJson: { type: "doc", attrs: { second: 2, first: 1 } },
      contentHtml: "<h2>Раздел</h2><p>Текст</p>",
      coverAlt: "Обложка",
      slug: "russkiy-original",
      sources: [{ text: "Источник" }],
      bibliography: [],
      seoTitle: "Русский оригинал",
      seoDescription: "Описание",
      seoKeywords: ["литература"],
      ogTitle: "Русский оригинал",
      ogDescription: "Описание",
    };

    expect(articleTranslationSourceHash(base)).toBe(
      articleTranslationSourceHash({
        ...base,
        contentJson: { attrs: { first: 1, second: 2 }, type: "doc" },
      })
    );
    expect(articleTranslationSourceHash(base)).not.toBe(
      articleTranslationSourceHash({ ...base, title: "Изменённый оригинал" })
    );
  });

  it("reuses approval only when both source and English payload are unchanged", () => {
    expect(
      canReuseEnglishTranslationApproval({
        persistedSourceHash: "source-a",
        currentSourceHash: "source-a",
        persistedContentHash: "english-a",
        currentContentHash: "english-a",
      })
    ).toBe(true);
    expect(
      canReuseEnglishTranslationApproval({
        persistedSourceHash: "source-a",
        currentSourceHash: "source-a",
        persistedContentHash: "english-a",
        currentContentHash: "english-edited",
      })
    ).toBe(false);
  });

  it("blocks release without an approved, complete English version", () => {
    const issues = englishTranslationReleaseIssues({
      enabled: true,
      status: "review",
      title: "English title",
      subtitle: "",
      excerpt: "Too short",
      contentHtml: "<p>Short text</p>",
      slug: "english-title",
      coverUrl: null,
      coverAlt: "",
      seoTitle: "English title",
      seoDescription: "Too short",
      seoKeywords: [],
      ogTitle: "English title",
      ogDescription: "Too short",
      sources: [],
      bibliography: [],
    });

    expect(issues).toContain("approve or publish the English translation");
    expect(issues).toContain("add at least 250 English words");
    expect(issues).toContain("add the English cover description");
  });

  it("blocks a mixed-language body from being released as English", () => {
    const issues = englishTranslationReleaseIssues({
      enabled: true,
      status: "approved",
      title: "A complete English title",
      subtitle: "An English subtitle",
      excerpt:
        "A sufficiently detailed English excerpt that otherwise satisfies the release threshold for the article card.",
      contentHtml: `<h2>English heading</h2><p>${`${"English prose ".repeat(130)}русская вставка.`}</p>`,
      slug: "complete-english-title",
      coverUrl: "https://example.org/cover.jpg",
      coverAlt: "A descriptive English cover caption",
      seoTitle: "A complete English title",
      seoDescription:
        "A sufficiently detailed English search description that otherwise satisfies the publication threshold.",
      seoKeywords: ["literature"],
      ogTitle: "A complete English title",
      ogDescription:
        "A sufficiently detailed English social description that otherwise satisfies the publication threshold.",
      sources: [{ title: "A source" }],
      bibliography: [],
    });

    expect(issues).toContain(
      "remove Cyrillic text from the English translation"
    );
  });

  it("builds an exact compensating payload for the Russian article", () => {
    const previousValues = Object.fromEntries(
      articleCompensationFields.map((field) => [field, `previous:${field}`])
    );
    const snapshot = {
      ...previousValues,
      id: "article-id",
      updated_at: "must-not-be-restored",
      categories: { slug: "essays" },
    };

    expect(articleCompensationPayload(snapshot)).toEqual(previousValues);
    expect(Object.keys(articleCompensationPayload(snapshot))).toEqual(
      articleCompensationFields
    );
  });

  it("builds an exact compensating payload for the prior English version", () => {
    const previousValues = Object.fromEntries(
      englishTranslationCompensationFields.map((field) => [
        field,
        `previous:${field}`,
      ])
    );
    const snapshot = {
      ...previousValues,
      id: "translation-id",
      article_id: "article-id",
      locale: "en",
      updated_at: "must-not-be-restored",
    };

    expect(englishTranslationCompensationPayload(snapshot)).toEqual(
      previousValues
    );
    expect(
      Object.keys(englishTranslationCompensationPayload(snapshot))
    ).toEqual(englishTranslationCompensationFields);
  });
});
