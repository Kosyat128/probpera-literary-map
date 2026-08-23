import { describe, expect, it, vi } from "vitest";

import {
  protectedArticleHtmlSignature,
  translateArticleSourceToEnglish,
  type AutoTranslationSource,
} from "./auto-translate-article";

const longEnglishParagraph = Array.from(
  { length: 280 },
  (_, index) => `literary${index + 1}`
).join(" ");

const source: AutoTranslationSource = {
  title: "Русская литературная статья",
  subtitle: "Подзаголовок",
  excerpt:
    "Это достаточно длинное описание русской статьи, подготовленное для карточки, поиска и редакционной проверки публикации.",
  contentHtml:
    '<h2 id="context">Контекст</h2><p>Русский текст <a href="https://example.com/source" target="_blank" rel="noopener noreferrer">источник</a>.</p><figure class="article-image"><img src="https://cdn.example.com/image.webp" alt="Русская подпись" loading="lazy"><figcaption>Подпись</figcaption></figure>',
  coverAlt: "Главная иллюстрация к русской литературной статье",
  sources: ["Источник: https://example.com/source"],
  bibliography: [
    "Книга. Москва, 2024. ISBN 978-5-17-123456-7. DOI 10.1234/probpera.test.",
  ],
  seoTitle: "Русская литературная статья",
  seoDescription:
    "Подробное SEO-описание русской литературной статьи, достаточное для корректной публикации и поисковой выдачи.",
  seoKeywords: ["литература", "книги"],
  ogTitle: "Русская литературная статья",
  ogDescription: "Описание материала для социальных карточек и ссылок.",
};

function translatedPayload(contentHtml: string) {
  return {
    title: "A Russian Literary Essay",
    subtitle: "A subtitle for international readers",
    excerpt:
      "A carefully edited English description of the literary article for cards, search results, and international readers around the world.",
    content_html: contentHtml,
    cover_alt: "Main illustration for the literary article",
    seo_title: "A Russian Literary Essay",
    seo_description:
      "A detailed English SEO description of the literary article, prepared for accurate search presentation and publication to international readers.",
    seo_keywords: ["literature", "books"],
    og_title: "A Russian Literary Essay",
    og_description:
      "A polished description of the article for social previews and shared links.",
    sources: ["Source: https://example.com/source"],
    bibliography: [
      "Book. Moscow, 2024. ISBN 978-5-17-123456-7. DOI 10.1234/probpera.test.",
    ],
  };
}

function translatedHtml() {
  return (
    `<h2 id="context">Context</h2><p>${longEnglishParagraph} ` +
    '<a href="https://example.com/source" target="_blank" rel="noopener noreferrer">source</a>.</p>' +
    '<figure class="article-image"><img src="https://cdn.example.com/image.webp" alt="Literary illustration" loading="lazy"><figcaption>Caption</figcaption></figure>'
  );
}

function openAiResponse(payload: unknown, suffix: string) {
  return new Response(
    JSON.stringify({
      id: `resp_test_${suffix}`,
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(payload),
            },
          ],
        },
      ],
      usage: { input_tokens: 1200, output_tokens: 1800 },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": `req_test_${suffix}`,
      },
    }
  );
}

function twoPassFetch(finalPayload: unknown) {
  const draft = translatedPayload(translatedHtml());
  return vi
    .fn()
    .mockImplementationOnce(async () => openAiResponse(draft, "draft"))
    .mockImplementationOnce(async () => openAiResponse(finalPayload, "review")) as unknown as typeof fetch;
}

describe("premium literary article translation", () => {
  it("uses two pro-max passes and preserves protected article structure", async () => {
    const payload = translatedPayload(translatedHtml());
    const fetchImpl = twoPassFetch(payload);

    const result = await translateArticleSourceToEnglish(source, {
      apiKey: "test-key",
      model: "gpt-test",
      reviewerModel: "gpt-review-test",
      reasoningEffort: "max",
      reasoningMode: "pro",
      reviewerReasoningEffort: "max",
      reviewerReasoningMode: "pro",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.title).toBe("A Russian Literary Essay");
    expect(result.model).toBe("gpt-test");
    expect(result.reviewModel).toBe("gpt-review-test");
    expect(result.requestId).toBe("req_test_draft");
    expect(result.reviewRequestId).toBe("req_test_review");
    expect(result.translatorReasoningEffort).toBe("max");
    expect(result.reviewerReasoningMode).toBe("pro");
    expect(protectedArticleHtmlSignature(result.content_html)).toEqual(
      protectedArticleHtmlSignature(source.contentHtml)
    );

    const firstRequest = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body)
    );
    const secondRequest = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]?.body)
    );
    expect(firstRequest.model).toBe("gpt-test");
    expect(firstRequest.reasoning).toEqual({ effort: "max", mode: "pro" });
    expect(firstRequest.max_output_tokens).toBe(60_000);
    expect(secondRequest.model).toBe("gpt-review-test");
    expect(secondRequest.reasoning).toEqual({ effort: "max", mode: "pro" });
    expect(secondRequest.input).toContain("DRAFT_TRANSLATION");
  });

  it("rejects a final review that changes a protected source URL", async () => {
    const badReview = {
      ...translatedPayload(translatedHtml()),
      sources: ["Source: https://attacker.invalid/changed"],
    };

    await expect(
      translateArticleSourceToEnglish(source, {
        apiKey: "test-key",
        model: "gpt-test",
        reviewerModel: "gpt-review-test",
        fetchImpl: twoPassFetch(badReview),
      })
    ).rejects.toThrow("changed a protected sources URL");
  });

  it("rejects Cyrillic left in any reader-facing English field", async () => {
    const badReview = {
      ...translatedPayload(translatedHtml()),
      title: "English title Русский",
    };

    await expect(
      translateArticleSourceToEnglish(source, {
        apiKey: "test-key",
        model: "gpt-test",
        reviewerModel: "gpt-review-test",
        fetchImpl: twoPassFetch(badReview),
      })
    ).rejects.toThrow("left Cyrillic");
  });

  it("rejects changed years, ISBNs or DOIs", async () => {
    const badReview = {
      ...translatedPayload(translatedHtml()),
      bibliography: [
        "Book. Moscow, 2025. ISBN 978-5-17-123456-7. DOI 10.1234/probpera.test.",
      ],
    };

    await expect(
      translateArticleSourceToEnglish(source, {
        apiKey: "test-key",
        model: "gpt-test",
        reviewerModel: "gpt-review-test",
        fetchImpl: twoPassFetch(badReview),
      })
    ).rejects.toThrow("changed a protected year, ISBN or DOI");
  });

  it("supports a controlled single-pass fallback without changing safeguards", async () => {
    const payload = translatedPayload(translatedHtml());
    const fetchImpl = vi.fn(async () =>
      openAiResponse(payload, "single")
    ) as unknown as typeof fetch;

    const result = await translateArticleSourceToEnglish(source, {
      apiKey: "test-key",
      model: "gpt-test",
      review: false,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.reviewModel).toBeNull();
    expect(result.reviewRequestId).toBeNull();
  });
});
