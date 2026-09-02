import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const imageViewSource = readFileSync(
  new URL("./EditorialImageView.tsx", import.meta.url),
  "utf8"
);
const editorStyles = readFileSync(
  new URL("../app/styles/editors.css", import.meta.url),
  "utf8"
);

describe("editorial image placement controls", () => {
  it("lets editors resize and move standalone images without affecting gallery children", () => {
    expect(imageViewSource).toContain('editor.state.doc.resolve(position).depth === 0');
    expect(imageViewSource).toContain('aria-label="Переместить изображение выше"');
    expect(imageViewSource).toContain('aria-label="Переместить изображение ниже"');
    expect(imageViewSource).toContain("data-drag-handle");
    expect(imageViewSource).toContain('aria-label="Масштаб изображения"');
    expect(imageViewSource).toContain("editor.state.tr.replaceWith(from, to, replacement)");
    expect(editorStyles).toContain(".editorial-image-width-slider");
  });
});
