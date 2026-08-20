import { describe, expect, it } from "vitest";

import {
  positionLeadingIllustrationHtml,
  positionLeadingIllustrationJson,
} from "./article-leading-illustration";

describe("leading article illustration placement", () => {
  it("moves a direct first image after the complete lead and before H2", () => {
    const result = positionLeadingIllustrationHtml(
      '<img src="https://cdn.example/lead.webp" alt="Иллюстрация"><aside class="article-lead"><p>Предисловие.</p></aside><p>Лид.</p><h2>Первый раздел</h2>'
    );
    expect(result.indexOf("Лид.")).toBeLessThan(result.indexOf("<img"));
    expect(result.indexOf("<img")).toBeLessThan(result.indexOf("<h2"));
    expect(result.match(/lead\.webp/gu)).toHaveLength(1);
  });

  it("does not pull an illustration out of a gallery or a later section", () => {
    const gallery =
      '<p>Лид.</p><section class="article-design-block is-gallery"><img src="https://cdn.example/gallery.webp" alt="Галерея"></section><h2>Раздел</h2>';
    const later =
      '<p>Лид.</p><h2>Раздел</h2><img src="https://cdn.example/later.webp" alt="Раздел">';
    expect(positionLeadingIllustrationHtml(gallery)).toBe(gallery);
    expect(positionLeadingIllustrationHtml(later)).toBe(later);
  });

  it("keeps Tiptap JSON in the same logical order as HTML", () => {
    const result = positionLeadingIllustrationJson({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://cdn.example/lead.webp" } },
        { type: "paragraph", content: [{ type: "text", text: "Предисловие" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Раздел" }] },
      ],
    }) as { content: Array<{ type: string }> };
    expect(result.content.map((node) => node.type)).toEqual([
      "paragraph",
      "image",
      "heading",
    ]);
  });
});
