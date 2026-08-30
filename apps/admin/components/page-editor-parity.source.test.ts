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

  it("offers the shared media placeholder and structured collection foundation", () => {
    expect(pageEditorSource).toContain(
      'insertEditorialBlock(editor, "media")'
    );
    expect(pageEditorSource).toContain('openMediaCollection("gallery")');
    expect(pageEditorSource).toContain('openMediaCollection("slider")');
    expect(pageEditorSource).toContain("<GalleryEditor");
    expect(pageEditorSource).toContain('contextLabel="страницы"');
    expect(pageEditorSource).toContain(
      'insertEditorialGallery(editor, items, "странице", settings)'
    );
    expect(pageEditorSource).toContain(
      'insertEditorialSlider(editor, items, "странице", settings)'
    );
    expect(pageEditorSource).toContain(
      "openCollectionLibrary(appendMediaComposerItems)"
    );
    expect(pageEditorSource).toContain(
      "openCollectionPicker(appendMediaComposerItems)"
    );
    expect(galleryEditorSource).toContain("contextLabel = \"статьи\"");
    expect(galleryEditorSource).toContain("EDITORIAL_GALLERY_MAX_ITEMS");
    expect(galleryEditorSource).toContain("settings.columnsDesktop");
    expect(editorialBlockSource).toContain("normalizeEditorialGalleryItems");
    expect(editorialBlockSource).toContain("galleryColumnsDesktop");
    expect(editorialBlockSource).not.toContain("slice(0, 8)");
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

  it("keeps every page publication and revision restore behind media guards", () => {
    expect(pageActionsSource).toContain("sanitizeStoredPageContent(");
    expect(pageActionsSource).toContain("assertPagePublicationMedia(");
    expect(pageActionsSource).toContain("editorialMediaHtmlAccessibilityIssues(");
    expect(pageActionsSource).toContain(
      '.select("content_json,content_html")'
    );
    expect(pageActionsSource).toContain(
      "Восстанавливаемая версия страницы"
    );
    expect(pageActionsSource).toContain(
      "content_html: restoredContent.contentHtml"
    );
    expect(pageActionsSource).toContain(
      "content_json: restoredContent.contentJson"
    );
    expect(pageActionsSource).toContain(
      "content_json: checkedPublicationContent.contentJson"
    );
    expect(pageActionsSource).toContain(
      "content_html: checkedPublicationContent.contentHtml"
    );
  });
});
