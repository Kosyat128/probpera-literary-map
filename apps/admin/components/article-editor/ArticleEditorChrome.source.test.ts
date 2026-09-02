import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

describe("article editor chrome module boundaries", () => {
  it("keeps toolbar state and handlers owned by ArticleEditor", () => {
    const article = source("../ArticleEditor.tsx");
    const toolbar = source("./ArticleEditorToolbar.tsx");
    const core = source("./EditorCore.tsx");

    expect(article).toContain("<EditorCore");
    expect(article).toContain("imageUploadActive: isImageUploadActive");
    expect(article).toContain("imageUploadBusy: editorMedia.busy");
    expect(article).toContain('addGallery: () => addMediaCollection("gallery")');
    expect(article).toContain('addSlider: () => addMediaCollection("slider")');
    expect(core).toContain("<ArticleEditorToolbar");
    expect(toolbar).toContain("<RichEditorToolbar");
    expect(toolbar).toContain('ToolbarMenu label="＋ Блок"');
    expect(toolbar).toContain('ToolbarMenu label="Фото и галереи"');
    expect(toolbar).toContain('ToolbarMenu label="Цвет текста"');
    expect(toolbar).toContain('ToolbarMenu label="Ещё"');
    expect(toolbar).toContain("insertEditorialBlock(editor");
    expect(toolbar).toContain("setEditorialBlockReveal(editor");
    expect(toolbar).not.toContain("useState");
    expect(toolbar).not.toContain("useReducer");
    expect(core).not.toContain("useState");
    expect(core).not.toContain("useReducer");
  });

  it("uses the shared structured gallery model with a one-hundred-item cap", () => {
    const article = source("../ArticleEditor.tsx");
    const gallery = source("./GalleryEditor.tsx");
    const blockView = source("../EditorialBlockView.tsx");
    const editorStyles = source("../../app/styles/editors.css");

    expect(article).toContain("<GalleryEditor");
    expect(article).toContain(
      "const confirmMediaCollection = (settings: EditorialGallerySettings) =>"
    );
    expect(article).toContain("parseEditorialGalleryUrls(mediaComposerValue)");
    expect(article).toContain("mergeEditorialGalleryItems(");
    expect(article).not.toContain(".slice(0, 8)");
    expect(article).toContain('insertEditorialSlider(editor, items, "статье", settings)');
    expect(article).toContain('insertEditorialGallery(editor, items, "статье", settings)');
    expect(article).toContain("openCollectionLibrary(appendMediaComposerItems)");
    expect(article).toContain("openCollectionPicker(appendMediaComposerItems)");
    expect(article).toContain(
      "reorderEditorialGalleryItems(current, fromIndex, toIndex)"
    );
    expect(gallery).toContain("EDITORIAL_GALLERY_MAX_ITEMS");
    expect(gallery).toContain("settings.columnsDesktop");
    expect(gallery).toContain("settings.autoplay");
    expect(gallery).toContain("Выбрать в медиатеке");
    expect(gallery).toContain("Загрузить с компьютера");
    expect(gallery).toContain("onMoveItem(fromIndex, toIndex)");
    expect(gallery).toContain("onDragStart={(event) => startDrag(event, index)}");
    expect(gallery).toContain("onDrop={(event) => dropItem(event, index)}");
    expect(gallery).toContain("используйте стрелки");
    expect(gallery).not.toContain(".slice(0, 8)");
    expect(blockView).toContain('event.target.closest(".editorial-image-node")');
    expect(blockView).toContain("onClick={handleCollectionClick}");
    expect(blockView).toContain("reorderEditorialGalleryItems(");
    expect(blockView).toContain(
      "onDragStart={(event) => startImageDrag(event, imageIndex)}"
    );
    expect(blockView).toContain("onDrop={(event) => dropImage(event, imageIndex)}");
    expect(blockView).toContain('role="status"');
    expect(editorStyles).toContain("content-visibility: auto");
    expect(editorStyles).toContain("contain-intrinsic-size: 280px 220px");
  });
});
