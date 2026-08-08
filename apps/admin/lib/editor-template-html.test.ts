import { describe, expect, it } from "vitest";

import { sanitizeEditorTemplateHtml } from "./editor-template-html";

describe("editor template HTML", () => {
  it("preserves image position and caption metadata", () => {
    const html = sanitizeEditorTemplateHtml(`
      <img
        class="article-image is-left"
        src="https://cdn.example.test/image.webp"
        alt="Портрет писателя"
        data-image-layout="left"
        data-caption="Архивный портрет"
      >
    `);

    expect(html).toContain('class="article-image is-left"');
    expect(html).toContain('data-image-layout="left"');
    expect(html).toContain('data-caption="Архивный портрет"');
  });

  it("still removes executable attributes and unsafe image URLs", () => {
    const html = sanitizeEditorTemplateHtml(
      '<img src="javascript:alert(1)" alt="Проверка" onerror="alert(1)" data-image-layout="wide">'
    );

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
    expect(html).toContain('data-image-layout="wide"');
  });
});
