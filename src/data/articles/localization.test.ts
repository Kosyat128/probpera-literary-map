import { describe, expect, it } from "vitest";

import type {
  ArticleCatalogEntry,
  ArticleCatalogTranslation,
} from "./catalog";
import {
  articleCatalogEntryForLanguage,
  articleDocumentForLanguage,
  type LocalizableArticleDocument,
} from "./localization";

const englishTranslation: ArticleCatalogTranslation = {
  locale: "en",
  title: "An approved English title",
  description: "An editor-approved English summary.",
  sectionLabel: "Literature and culture",
  publishedLabel: "Published: 8 August 2026",
  publishedAt: "2026-08-08T10:00:00.000Z",
  readingMinutes: 2,
  wordCount: 240,
  headingCount: 1,
  slug: "approved-english-title",
  translationStatus: "approved",
  canonicalUrl: null,
};

function article(
  translations?: ArticleCatalogEntry["translations"]
): ArticleCatalogEntry {
  return {
    id: "cms-article-id",
    url: "https://probpera.ru/stati/o-literature/russkiy-zagolovok/",
    title: "Русский заголовок",
    description: "Русское описание",
    imageAlt: "Русская подпись изображения",
    sectionId: "literary-essays",
    sectionLabel: "О литературе и культуре",
    publishedLabel: "Опубликовано: 8 августа 2026",
    readingMinutes: 3,
    wordCount: 360,
    headingCount: 2,
    slug: "russkiy-zagolovok",
    documentPath: "cms/articles/cms-article-id.json",
    translations,
  };
}

describe("article localization", () => {
  it("selects approved English catalog fields and their public route", () => {
    const localized = articleCatalogEntryForLanguage(
      article({ en: englishTranslation }),
      "en"
    );

    expect(localized).toMatchObject({
      title: "An approved English title",
      description: "An editor-approved English summary.",
      imageAlt: "",
      sectionLabel: "Literature and culture",
      publishedLabel: "Published: 8 August 2026",
      slug: "approved-english-title",
      url: "https://probpera.ru/stati/o-literature/approved-english-title/",
      canonicalUrl:
        "https://probpera.ru/stati/o-literature/approved-english-title/",
      documentPath: "cms/articles/cms-article-id.json",
    });
  });

  it("keeps the English route usable when canonical points to the Russian edition", () => {
    const localized = articleCatalogEntryForLanguage(
      article({
        en: {
          ...englishTranslation,
          canonicalUrl:
            "https://probpera.ru/stati/o-literature/editorial-canonical/",
        },
      }),
      "en"
    );

    expect(localized).toMatchObject({
      slug: "approved-english-title",
      url: "https://probpera.ru/stati/o-literature/approved-english-title/",
      canonicalUrl:
        "https://probpera.ru/stati/o-literature/editorial-canonical/",
    });
  });

  it("returns an honest absence instead of the Russian catalog fallback", () => {
    expect(articleCatalogEntryForLanguage(article(), "en")).toBeNull();
  });

  it("rejects a released catalog translation that still contains Cyrillic", () => {
    expect(
      articleCatalogEntryForLanguage(
        article({
          en: {
            ...englishTranslation,
            description: "An English summary with незавершённый перевод.",
          },
        }),
        "en"
      )
    ).toBeNull();
  });

  it("filters untranslated records out of an English catalogue", () => {
    const visibleArticles = [
      article(),
      {
        ...article({ en: englishTranslation }),
        id: "translated-article",
      },
    ].flatMap((entry) => {
      const localized = articleCatalogEntryForLanguage(entry, "en");
      return localized ? [localized] : [];
    });

    expect(visibleArticles.map((entry) => entry.title)).toEqual([
      "An approved English title",
    ]);
    expect(visibleArticles.some((entry) => /[А-Яа-яЁё]/u.test(entry.title))).toBe(
      false
    );
  });

  it("selects the English document body and never reuses Russian sources", () => {
    const document: LocalizableArticleDocument = {
      ...article(),
      headings: [{ id: "ru", level: 2, text: "Русский раздел" }],
      contentHtml: "<p>Русский текст</p>",
      plainText: "Русский текст",
      sources: ["Русский комментарий к источнику"],
      translations: {
        en: {
          ...englishTranslation,
          headings: [{ id: "english", level: 2, text: "English section" }],
          contentHtml: "<p>Editor-approved English text</p>",
          plainText: "Editor-approved English text",
        },
      },
    };

    const localized = articleDocumentForLanguage(document, "en");

    expect(localized?.title).toBe("An approved English title");
    expect(localized?.slug).toBe("approved-english-title");
    expect(localized?.url).toBe(
      "https://probpera.ru/stati/o-literature/approved-english-title/"
    );
    expect(localized?.contentHtml).toBe("<p>Editor-approved English text</p>");
    expect(localized?.headings).toEqual([
      { id: "english", level: 2, text: "English section" },
    ]);
    expect(localized?.sources).toEqual([]);
  });

  it("does not expose Russian HTML when the exported English document is absent", () => {
    const document: LocalizableArticleDocument = {
      ...article(),
      headings: [],
      contentHtml: "<p>Русский текст</p>",
      plainText: "Русский текст",
      translations: undefined,
    };

    expect(articleDocumentForLanguage(document, "en")).toBeNull();
    expect(articleDocumentForLanguage(document, "ru")?.contentHtml).toBe(
      "<p>Русский текст</p>"
    );
  });

  it("does not expose an approved English document with a Russian body fragment", () => {
    const document: LocalizableArticleDocument = {
      ...article(),
      headings: [],
      contentHtml: "<p>Русский текст</p>",
      plainText: "Русский текст",
      translations: {
        en: {
          ...englishTranslation,
          headings: [{ id: "mixed", level: 2, text: "English heading" }],
          contentHtml: "<p>English text with русская вставка.</p>",
          plainText: "English text with русская вставка.",
        },
      },
    };

    expect(articleDocumentForLanguage(document, "en")).toBeNull();
  });

  it("does not expose Cyrillic hidden in English media or source metadata", () => {
    const document: LocalizableArticleDocument = {
      ...article(),
      headings: [],
      contentHtml: "<p>Русский текст</p>",
      plainText: "Русский текст",
      translations: {
        en: {
          ...englishTranslation,
          headings: [{ id: "english", level: 2, text: "English heading" }],
          contentHtml:
            '<h2>English heading</h2><p>English body.</p><img alt="Русская подпись" src="/cover.jpg">',
          plainText: "English heading English body.",
          sources: [{ text: "English source" }],
          bibliography: [],
        },
      },
    };

    expect(articleDocumentForLanguage(document, "en")).toBeNull();

    document.translations!.en!.contentHtml =
      "<h2>English heading</h2><p>English body.</p>";
    document.translations!.en!.sources = [{ text: "Русский источник" }];
    expect(articleDocumentForLanguage(document, "en")).toBeNull();
  });
});
