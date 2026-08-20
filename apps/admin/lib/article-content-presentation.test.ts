import { describe, expect, it } from "vitest";

import {
  articleTextTones,
  articleTextTone,
  safeTextToneSpanAttributes,
  sanitizeArticleTextToneJson,
} from "./article-content-presentation";

describe("safe article presentation tokens", () => {
  it("accepts only the editorial palette", () => {
    expect(articleTextTones).toHaveLength(24);
    expect(articleTextTone("forest")).toBe("forest");
    expect(articleTextTone("charcoal")).toBe("charcoal");
    expect(articleTextTone("expression(alert(1))")).toBeNull();
    expect(articleTextTone("#00ff00")).toBeNull();
  });

  it("removes an untrusted tone mark from Tiptap JSON", () => {
    const result = sanitizeArticleTextToneJson({
      type: "doc",
      content: [
        {
          type: "text",
          text: "Пример",
          marks: [
            { type: "bold" },
            {
              type: "textTone",
              attrs: { tone: "forest", style: "position:fixed" },
              injected: true,
            },
            { type: "textTone", attrs: { tone: "url(javascript:alert(1))" } },
          ],
        },
      ],
    }) as { content: Array<{ marks: unknown[] }> };

    expect(result.content[0].marks).toEqual([
      { type: "bold" },
      { type: "textTone", attrs: { tone: "forest" } },
    ]);
  });

  it("canonicalizes HTML classes and never accepts arbitrary tone values", () => {
    expect(
      safeTextToneSpanAttributes({
        class: "legacy article-text-tone is-tone-old",
        "data-text-tone": "ocean",
      })
    ).toEqual({
      class: "article-text-tone is-tone-ocean",
      "data-text-tone": "ocean",
    });
    expect(
      safeTextToneSpanAttributes({
        class: "article-text-tone is-tone-old",
        "data-text-tone": "red;position:fixed",
      })
    ).toEqual({});
  });
});
