import { describe, expect, it } from "vitest";

import {
  buildArticleValidation,
  countArticleHtmlWords,
  type ArticleValidationInput,
} from "./useArticleValidation";

const longText = Array.from({ length: 250 }, (_, index) => `слово${index}`).join(" ");

function validInput(
  overrides: Partial<ArticleValidationInput> = {}
): ArticleValidationInput {
  return {
    title: "Проверенная статья",
    slug: "proverennaya-statya",
    categoryId: "category-id",
    contentHtml: `<h2>Раздел</h2><p>${longText}</p>`,
    excerpt: "Краткое описание редакционного материала, которое уверенно превышает восемьдесят знаков для карточки.",
    coverUrl: "https://cdn.example/cover.webp",
    coverAlt: "Подробное описание обложки",
    seoDescription: "Подробное описание публикации для поисковых систем, которое также превышает требуемые восемьдесят знаков.",
    sourceText: "Источник - https://example.com",
    englishEnabled: false,
    englishStatus: "draft",
    englishTitle: "Reviewed article",
    englishSlug: "reviewed-article",
    englishContentHtml: `<h2>Section</h2><p>${longText}</p>`,
    englishExcerpt: "A sufficiently detailed English excerpt that is deliberately longer than eighty characters for the publication card.",
    englishCoverAlt: "Detailed English cover description",
    englishSeoDescription: "A sufficiently detailed English search description that is deliberately longer than eighty characters.",
    englishSourceText: "Source - https://example.com",
    englishConfirmedCurrentSource: false,
    englishSourceContentHash: "content-hash",
    russianSourceChanged: false,
    ...overrides,
  };
}

describe("article validation", () => {
  it("keeps the established HTML word counting semantics", () => {
    expect(countArticleHtmlWords("<h2>Два слова</h2><p>ещё&nbsp;три</p>")).toBe(4);
  });

  it("accepts a complete Russian publication", () => {
    const result = buildArticleValidation(validInput());

    expect(result.ready).toBe(true);
    expect(result.checks).toHaveLength(9);
    expect(result.russianWordCount).toBeGreaterThanOrEqual(250);
  });

  it("blocks an unresolved media placeholder", () => {
    const result = buildArticleValidation(
      validInput({
        contentHtml: `<h2>Раздел</h2><p>${longText}</p><section data-editorial-block="media"><p>Место</p></section>`,
      })
    );

    expect(result.ready).toBe(false);
    expect(
      result.checks.find(
        (item) => item.label === "Все места для изображений заменены"
      )?.ok
    ).toBe(false);
  });

  it("requires a fresh confirmation when the Russian source changed", () => {
    const result = buildArticleValidation(
      validInput({
        englishEnabled: true,
        englishStatus: "approved",
        russianSourceChanged: true,
      })
    );

    expect(result.checks).toHaveLength(18);
    expect(result.ready).toBe(false);
    expect(
      result.checks.find(
        (item) =>
          item.label === "English: перевод сверен с текущим оригиналом"
      )?.ok
    ).toBe(false);
  });
});
