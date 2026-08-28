import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const dialogSource = source("./EditorLinkDialog.tsx");
const articleEditorSource = source("./ArticleEditor.tsx");
const pageEditorSource = source("./PageEditor.tsx");
const extensionsSource = source("./rich-editor/RichEditorExtensions.ts");

const persistedHtmlSanitizers = [
  source("../app/(dashboard)/articles/legacy-import-action.ts"),
  source("../app/(dashboard)/articles/atomic-standard-save-action.ts"),
  source("../app/(dashboard)/pages/actions.ts"),
  source("../lib/auto-translate-article-core.ts"),
  source("../lib/auto-translate-article-premium.ts"),
];

describe("shared editor link workflow", () => {
  it("offers debounced authorized internal autocomplete and safe manual links", () => {
    expect(dialogSource).toContain("searchEditorInternalLinksAction(query)");
    expect(dialogSource).toContain("window.setTimeout");
    expect(dialogSource).toContain("}, 250)");
    expect(dialogSource).toContain("normalizeEditorLinkAttributes({");
    expect(dialogSource).toContain("editorLinkRelFlags.map");
    expect(dialogSource).toContain("Открывать в новой вкладке");
    expect(dialogSource).toContain("nofollow");
    expect(dialogSource).toContain("sponsored");
    expect(dialogSource).toContain("ugc");
    expect(dialogSource).not.toContain("window.prompt");
  });

  it("applies the full mark attributes in both editor surfaces", () => {
    for (const editorSource of [articleEditorSource, pageEditorSource]) {
      expect(editorSource).toContain('getAttributes("link") || {}');
      expect(editorSource).toContain(
        "onApply={(attributes: EditorLinkAttributes) =>"
      );
      expect(editorSource).toContain(".setLink(attributes)");
    }
    expect(extensionsSource).toContain(
      "HTMLAttributes: { target: null, rel: null }"
    );
  });

  it("preserves selected target and rel flags across every save path", () => {
    for (const sanitizerSource of persistedHtmlSanitizers) {
      expect(sanitizerSource).toContain("sanitizeEditorAnchorAttributes");
      expect(sanitizerSource).not.toContain('simpleTransform("a"');
    }
  });
});
