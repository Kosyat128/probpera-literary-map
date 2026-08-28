import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

describe("article editor chrome module boundaries", () => {
  it("keeps toolbar state and handlers owned by ArticleEditor", () => {
    const article = source("../ArticleEditor.tsx");
    const toolbar = source("./ArticleEditorToolbar.tsx");

    expect(article).toContain("<ArticleEditorToolbar");
    expect(article).toContain("disabled: isImageUploadActive");
    expect(article).toContain("imageUploadBusy: editorMedia.busy");
    expect(article).toContain('addGallery: () => addMediaCollection("gallery")');
    expect(article).toContain('addSlider: () => addMediaCollection("slider")');
    expect(toolbar).toContain("<RichEditorToolbar");
    expect(toolbar).toContain('ToolbarMenu label="＋ Блок"');
    expect(toolbar).toContain('ToolbarMenu label="Фото и галереи"');
    expect(toolbar).toContain('ToolbarMenu label="Цвет текста"');
    expect(toolbar).toContain('ToolbarMenu label="Ещё"');
    expect(toolbar).toContain("insertEditorialBlock(editor");
    expect(toolbar).toContain("setEditorialBlockReveal(editor");
    expect(toolbar).not.toContain("useState");
    expect(toolbar).not.toContain("useReducer");
  });

  it("keeps the legacy URL-only gallery parser and eight-item cap unchanged", () => {
    const article = source("../ArticleEditor.tsx");
    const gallery = source("./GalleryEditor.tsx");

    expect(article).toContain("<GalleryEditor");
    expect(article).toContain("const confirmMediaCollection = () =>");
    expect(article).toContain(".filter((item) => /^https:\\/\\//iu.test(item))");
    expect(article).toContain(".slice(0, 8)");
    expect(article).toContain("insertEditorialSlider(editor, urls)");
    expect(article).toContain("insertEditorialGallery(editor, urls)");
    expect(gallery).toContain(".slice(0, 8).length");
    expect(gallery).toContain("Вставьте до восьми HTTPS-адресов");
    expect(gallery).toContain("Открыть медиатеку ↗");
    expect(gallery).not.toContain("useState");
    expect(gallery).not.toContain("useReducer");
  });
});
