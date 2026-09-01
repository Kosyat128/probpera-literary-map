import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const editorSource = readFileSync(
  new URL("./ArticleEditor.tsx", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("./article-editor/useArticleValidation.ts", import.meta.url),
  "utf8"
);
const checklistSource = readFileSync(
  new URL("./article-editor/ValidationChecklist.tsx", import.meta.url),
  "utf8"
);
const toolbarSource = readFileSync(
  new URL("./article-editor/ArticleEditorToolbar.tsx", import.meta.url),
  "utf8"
);

describe("article editor publication and recovery wiring", () => {
  it("keeps English checks optional until the translation is enabled", () => {
    expect(editorSource).toContain("useArticleValidation({");
    expect(validationSource).toContain(
      "const checks = input.englishEnabled"
    );
    expect(checklistSource).toContain(
      '"Английский перевод не включён: можно выпустить только русский оригинал."'
    );
  });

  it("backs up the complete editor snapshot and flushes it when the page hides", () => {
    expect(editorSource).toContain("contentHtml,");
    expect(editorSource).toContain("contentJson,");
    expect(editorSource).toContain("coverUrl,");
    expect(editorSource).toContain('reason: "autosave"');
    expect(editorSource).toContain('reason: "before-submit"');
    expect(editorSource).toContain('document.addEventListener("visibilitychange"');
  });

  it("uses safe semantic text tones and restores the exact image caret", () => {
    expect(editorSource).toContain("ArticleTextTone");
    expect(toolbarSource).toContain("articleTextTones.map");
    expect(toolbarSource).toContain("AAA · от {tone.contrastRatio}:1");
    expect(toolbarSource).toContain(
      "24 редакционных оттенка с контрастом AAA"
    );
    expect(editorSource).toContain("insertImageAtRememberedPosition");
    expect(editorSource).toContain("imageSelectionRef.current.insertionPos");
    expect(editorSource).toContain("insertContentAt(insertionPosition");
    expect(editorSource).not.toContain("firstHeadingPosition ?? firstBlockEnd");
  });

  it("saves the current draft before opening a locale-specific preview", () => {
    expect(editorSource).toContain("ref={previewSubmitButtonRef}");
    expect(editorSource).toContain('value="preview"');
    expect(editorSource).toContain("previewLocale: activeLocale");
  });
});
