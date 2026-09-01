import { describe, expect, it } from "vitest";

import {
  buildArticleValidation,
  countArticleHtmlWords,
  type ArticleValidationInput,
} from "./useArticleValidation";

const longText = Array.from({ length: 250 }, (_, index) => `слово${index}`).join(" ");
const englishLongText = Array.from(
  { length: 250 },
  (_, index) => `word${index}`
).join(" ");

function validInput(
  overrides: Partial<ArticleValidationInput> = {}
): ArticleValidationInput {
  return {
    title: "Проверенная статья",
    slug: "proverennaya-statya",
    categoryId: "category-id",
    contentHtml: `<h2>Раздел</h2><p>${longText}</p>`,
    contentJson: JSON.stringify({ type: "doc", content: [] }),
    excerpt: "Краткое описание редакционного материала, которое уверенно превышает восемьдесят знаков для карточки.",
    coverUrl: "https://cdn.example/cover.webp",
    coverAlt: "Подробное описание обложки",
    seoDescription: "Подробное описание публикации для поисковых систем, которое также превышает требуемые восемьдесят знаков.",
    sourceText: "Источник - https://example.com",
    status: "draft",
    scheduledAt: "",
    englishEnabled: false,
    englishStatus: "draft",
    englishTitle: "Reviewed article",
    englishSubtitle: "",
    englishSlug: "reviewed-article",
    englishContentHtml: `<h2>Section</h2><p>${englishLongText}</p>`,
    englishContentJson: JSON.stringify({ type: "doc", content: [] }),
    englishExcerpt: "A sufficiently detailed English excerpt that is deliberately longer than eighty characters for the publication card.",
    englishCoverAlt: "Detailed English cover description",
    englishSeoTitle: "Reviewed article",
    englishSeoDescription: "A sufficiently detailed English search description that is deliberately longer than eighty characters.",
    englishSeoKeywords: "literature, review",
    englishOgTitle: "Reviewed article",
    englishOgDescription: "A detailed English social description.",
    englishSourceText: "Source - https://example.com",
    englishBibliographyText: "Book reference",
    englishConfirmedCurrentSource: false,
    englishSourceContentHash: "content-hash",
    russianSourceChanged: false,
    ...overrides,
  };
}

describe("article validation", () => {
  it("keeps the established HTML word counting semantics", () => {
    expect(countArticleHtmlWords("<h2>Два слова</h2><p>ещё&nbsp;три</p>")).toBe(4);
    expect(
      countArticleHtmlWords(
        "<p>Two&nbsp;words - &#116;hree</p><script>never count this</script>"
      )
    ).toBe(3);
  });

  it("accepts a complete Russian publication", () => {
    const result = buildArticleValidation(validInput());

    expect(result.ready).toBe(true);
    expect(result.checks).toHaveLength(11);
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

    expect(result.checks).toHaveLength(23);
    expect(result.ready).toBe(false);
    expect(
      result.checks.find(
        (item) =>
          item.label ===
          "Английская версия: перевод сверен с текущим оригиналом"
      )?.ok
    ).toBe(false);
  });

  it("requires a date for a scheduled release", () => {
    const result = buildArticleValidation(
      validInput({ status: "scheduled", scheduledAt: "" })
    );
    expect(result.ready).toBe(false);
    expect(
      result.checks.find((item) =>
        item.label.startsWith("Для публикации по расписанию")
      )?.ok
    ).toBe(false);
  });

  it("reports an inline image without an accessibility description", () => {
    const result = buildArticleValidation(
      validInput({
        contentJson: JSON.stringify({
          type: "doc",
          content: [{ type: "image", attrs: { src: "/image.webp", alt: "" } }],
        }),
      })
    );
    expect(result.ready).toBe(false);
    expect(
      result.checks.find((item) => item.label === "Все изображения имеют описание")
        ?.ok
    ).toBe(false);
  });

  it("matches server release checks for English placeholders and Cyrillic text", () => {
    const placeholder = buildArticleValidation(
      validInput({
        englishEnabled: true,
        englishStatus: "approved",
        englishContentHtml: `<h2>Section</h2><p>${englishLongText}</p><section data-editorial-block="media">Slot</section>`,
      })
    );
    expect(
      placeholder.checks.find(
        (item) =>
          item.label ===
          "Английская версия: все места для изображений заменены"
      )?.ok
    ).toBe(false);

    const cyrillic = buildArticleValidation(
      validInput({
        englishEnabled: true,
        englishStatus: "approved",
        englishSeoTitle: "English title with перевод",
      })
    );
    expect(
      cyrillic.checks.find((item) => item.label.includes("кириллицу"))?.ok
    ).toBe(false);
  });
});
