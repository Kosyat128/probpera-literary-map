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
        data-media-id="5f21359e-097b-46f0-b838-7ce948fd3cd1"
      >
    `);

    expect(html).toContain(
      'class="article-image is-left is-aspect-auto is-fit-contain"'
    );
    expect(html).toContain('data-image-layout="left"');
    expect(html).toContain('data-caption="Архивный портрет"');
    expect(html).toContain(
      'data-media-id="5f21359e-097b-46f0-b838-7ce948fd3cd1"'
    );
  });

  it("still removes executable attributes and unsafe image URLs", () => {
    const html = sanitizeEditorTemplateHtml(
      '<img src="javascript:alert(1)" alt="Проверка" onerror="alert(1)" data-image-layout="wide">'
    );

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
    expect(html).toContain('data-image-layout="wide"');
  });

  it("round-trips canonical semantic typography roles and rejects arbitrary values", () => {
    const html = sanitizeEditorTemplateHtml(`
      <p><span class="wrong is-scope-lead" data-typography-scope="lead">Лид</span></p>
      <p><span class="article-typography-scope is-scope-fixed" data-typography-scope="fixed">Опасный</span></p>
    `);

    expect(html).toContain(
      'class="article-typography-scope is-scope-lead" data-typography-scope="lead"'
    );
    expect(html).not.toContain("is-scope-fixed");
    expect(html).not.toContain('data-typography-scope="fixed"');
  });
});
