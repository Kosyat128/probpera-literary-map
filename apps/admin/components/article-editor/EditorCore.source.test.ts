import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

const article = source("../ArticleEditor.tsx");
const core = source("./EditorCore.tsx");
const translation = source("./TranslationPanel.tsx");

describe("article editor presentational composition", () => {
  it("keeps locale state and guarded switching in the parent", () => {
    expect(article).toContain("<TranslationPanel");
    expect(article).toContain("switchingDisabled: !editor || isImageUploadActive");
    expect(article).toContain("actions={{ switchLocale: switchEditorLocale }}");
    expect(article).toContain("const switchEditorLocale = useCallback");

    expect(translation).toContain("RU · авторский оригинал");
    expect(translation).toContain("EN · необязательный перевод");
    expect(translation).toContain("English translation");
    expect(translation).toContain("Russian text is never inserted as an");
    expect(translation).not.toMatch(/useState|useEffect|useReducer/u);
  });

  it("wires grouped editor model, actions, and refs without moving ownership", () => {
    expect(article).toContain("<EditorCore");
    expect(article).toContain("handleFileInput: editorMedia.handleFileInput");
    expect(article).toContain("handleEditorDrop: editorMedia.handleDrop");
    expect(article).toContain("handleEditorPaste: editorMedia.handlePaste");
    expect(article).toContain('registerWorkspaceSection("media", element)');
    expect(article).toContain('registerWorkspaceSection("text", element)');
    expect(article).toContain('addGallery: () => addMediaCollection("gallery")');
    expect(article).toContain('addSlider: () => addMediaCollection("slider")');

    expect(core).toContain("<ArticleEditorToolbar");
    expect(core).toContain("<EditorContent editor={model.editor}");
    expect(core).toContain('className="visually-hidden-file"');
    expect(core).toContain("ref={refs.mediaSectionRef}");
    expect(core).toContain("inert={model.imageUploadActive ? true : undefined}");
    expect(core).toContain("aria-busy={model.imageUploadActive}");
    expect(core).toContain("onDropCapture={(event) =>");
    expect(core).toContain("onPasteCapture={actions.handleEditorPaste}");
    expect(core).not.toMatch(/useState|useEffect|useReducer/u);
    expect(core).not.toMatch(/saveArticleAction|RecoveryController/u);
  });

  it("preserves templates, direct upload, and media affordance labels", () => {
    for (const label of [
      "Или начать с готовой структуры",
      "＋ Сохранить как шаблон",
      "Удалить мои шаблоны",
      "Медиатека ↗",
      "Оптимизируем изображение…",
      "Нажмите или перетащите фотографию сюда",
      "Отпустите изображение - оно появится в этом месте статьи",
    ]) {
      expect(core).toContain(label);
    }
  });
});
