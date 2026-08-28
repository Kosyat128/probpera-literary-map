import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageEditorSource = readFileSync(
  new URL("./PageEditor.tsx", import.meta.url),
  "utf8"
);
const pageActionsSource = readFileSync(
  new URL("../app/(dashboard)/pages/actions.ts", import.meta.url),
  "utf8"
);
const galleryEditorSource = readFileSync(
  new URL("./article-editor/GalleryEditor.tsx", import.meta.url),
  "utf8"
);
const editorialBlockSource = readFileSync(
  new URL("./EditorialBlock.ts", import.meta.url),
  "utf8"
);

describe("PageEditor Phase 3 parity", () => {
  it("reuses the safe semantic text foundation and block alignment", () => {
    expect(pageEditorSource).toContain("afterImage: [ArticleTextTone]");
    expect(pageEditorSource).toContain("articleTextTones.map");
    expect(pageEditorSource).toContain("unsetTextTone().run()");
    expect(pageEditorSource).toContain("setTextTone(tone.id).run()");
    expect(pageEditorSource).toContain('setTextAlign("left").run()');
    expect(pageEditorSource).toContain('setTextAlign("center").run()');
  });

  it("offers the shared media placeholder and legacy collection foundation", () => {
    expect(pageEditorSource).toContain(
      'insertEditorialBlock(editor, "media")'
    );
    expect(pageEditorSource).toContain('openMediaCollection("gallery")');
    expect(pageEditorSource).toContain('openMediaCollection("slider")');
    expect(pageEditorSource).toContain("<GalleryEditor");
    expect(pageEditorSource).toContain('contextLabel="страницы"');
    expect(pageEditorSource).toContain(
      'insertEditorialGallery(editor, urls, "странице")'
    );
    expect(pageEditorSource).toContain(
      'insertEditorialSlider(editor, urls, "странице")'
    );
    expect(galleryEditorSource).toContain("contextLabel = \"статьи\"");
    expect(galleryEditorSource).toContain(".slice(0, 8).length");
    expect(editorialBlockSource).toContain("...urls.slice(0, 8).map");
    expect(editorialBlockSource).not.toContain("mediaInspector");
  });

  it("sanitizes page text tones in both persisted HTML and TipTap JSON", () => {
    expect(pageActionsSource).toContain("safeTextToneSpanAttributes");
    expect(pageActionsSource).toContain("sanitizeArticleTextToneJson(");
    expect(pageActionsSource).toContain('"data-text-tone"');
    expect(pageActionsSource).toContain("span: (tagName");
    expect(pageActionsSource).toContain(
      "attribs: safeTextToneSpanAttributes(attributes)"
    );
  });
});
