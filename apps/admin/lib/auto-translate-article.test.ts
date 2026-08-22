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
  bibliography: ["Книга. Москва, 2024."],
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
    bibliography: ["Book. Moscow, 2024."],
  };
}

function openAiResponse(payload: unknown) {
  return new Response(
    JSON.stringify({
      id: "resp_test_translation",
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
        "x-request-id": "req_test_translation",
      },
    }
  );
}

describe("automatic literary article translation", () => {
  it("preserves protected HTML structure, links and image sources", async () => {
    const translatedHtml =
      `<h2 id="context">Context</h2><p>${longEnglishParagraph} ` +
      '<a href="https://example.com/source" target="_blank" rel="noopener noreferrer">source</a>.</p>' +
      '<figure class="article-image"><img src="https://cdn.example.com/image.webp" alt="Literary illustration" loading="lazy"><figcaption>Caption</figcaption></figure>';
    const fetchImpl = vi.fn(async () =>
      openAiResponse(translatedPayload(translatedHtml))
    ) as unknown as typeof fetch;

    const result = await translateArticleSourceToEnglish(source, {
      apiKey: "test-key",
      model: "gpt-test",
      fetchImpl,
    });

    expect(result.title).toBe("A Russian Literary Essay");
    expect(result.model).toBe("gpt-test");
    expect(result.requestId).toBe("req_test_translation");
    expect(result.inputTokens).toBe(1200);
    expect(result.outputTokens).toBe(1800);
    expect(result.content_html).toContain('href="https://example.com/source"');
    expect(result.content_html).toContain(
      'src="https://cdn.example.com/image.webp"'
    );
    expect(
      protectedArticleHtmlSignature(result.content_html)
    ).toEqual(protectedArticleHtmlSignature(source.contentHtml));

    const requestBody = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body)
    );
    expect(requestBody.model).toBe("gpt-test");
    expect(requestBody.store).toBe(false);
    expect(requestBody.text.format.type).toBe("json_schema");
  });

  it("rejects a translation that changes a protected link", async () => {
    const translatedHtml =
      `<h2 id="context">Context</h2><p>${longEnglishParagraph} ` +
      '<a href="https://attacker.invalid/changed" target="_blank" rel="noopener noreferrer">source</a>.</p>' +
      '<figure class="article-image"><img src="https://cdn.example.com/image.webp" alt="Literary illustration" loading="lazy"><figcaption>Caption</figcaption></figure>';
    const fetchImpl = vi.fn(async () =>
      openAiResponse(translatedPayload(translatedHtml))
    ) as unknown as typeof fetch;

    await expect(
      translateArticleSourceToEnglish(source, {
        apiKey: "test-key",
        model: "gpt-test",
        fetchImpl,
      })
    ).rejects.toThrow("changed protected HTML structure");
  });

  it("never attempts a network request without a server API key", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      translateArticleSourceToEnglish(source, {
        apiKey: "",
        model: "gpt-test",
        fetchImpl,
      })
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
