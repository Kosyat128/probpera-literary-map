import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const extensionsSource = readFileSync(
  new URL("./RichEditorExtensions.ts", import.meta.url),
  "utf8"
);
const toolbarSource = readFileSync(
  new URL("./RichEditorToolbar.tsx", import.meta.url),
  "utf8"
);
const imageDialogSource = readFileSync(
  new URL("./EditorImageDialog.tsx", import.meta.url),
  "utf8"
);
const articleSource = readFileSync(
  new URL("../ArticleEditor.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../PageEditor.tsx", import.meta.url),
  "utf8"
);
const articleToolbarSource = readFileSync(
  new URL("../article-editor/ArticleEditorToolbar.tsx", import.meta.url),
  "utf8"
);

describe("shared rich editor foundation", () => {
  it("keeps one ordered extension and base-toolbar contract in both editors", () => {
    for (const extension of [
      "StarterKit.configure",
      "TableKit",
      "Underline",
      "Link.configure",
      "EditorialImage",
      "TextAlign.configure",
      "Placeholder.configure",
    ]) {
      expect(extensionsSource).toContain(extension);
    }
    expect(extensionsSource).toContain("...afterStarterKit");
    expect(extensionsSource).toContain("...afterImage");

    for (const command of [
      "toggleBold",
      "toggleItalic",
      "toggleUnderline",
      "toggleHeading",
      "toggleBulletList",
      "toggleOrderedList",
      "toggleBlockquote",
      "insertTable",
      "setHorizontalRule",
      "undo",
      "redo",
    ]) {
      expect(toolbarSource).toContain(command);
    }
    expect(toolbarSource).toContain("([2, 3, 4, 5, 6] as const)");

    for (const editorSource of [articleSource, pageSource]) {
      expect(editorSource).toContain("createRichEditorExtensions({");
    }
    expect(articleSource).toContain("<ArticleEditorToolbar");
    expect(articleToolbarSource).toContain("<RichEditorToolbar");
    expect(pageSource).toContain("<RichEditorToolbar");
    expect(articleSource).toContain("afterStarterKit: [EditorialBlock]");
    expect(articleSource).toContain("afterImage: [ArticleTextTone]");
    expect(pageSource).toContain("afterStarterKit: [EditorialBlock]");
  });

  it("uses one controlled HTTPS image dialog without article image prompts", () => {
    expect(imageDialogSource).toContain('new URL(source).protocol !== "https:"');
    expect(imageDialogSource).toContain("EditorImageDialogValue");
    expect(articleSource).toContain("<EditorImageDialog");
    expect(pageSource).toContain("<EditorImageDialog");
    expect(pageSource).toContain("openImageUrlDialog");

    const articleImageWorkflow = articleSource.slice(
      articleSource.indexOf("const addImage ="),
      articleSource.indexOf("const insertImageAtLogicalPosition")
    );
    expect(articleImageWorkflow).not.toContain("window.prompt");
    expect(articleImageWorkflow).toContain("setImageDialogOpen(true)");
    expect(articleImageWorkflow).toContain("mediaId: null");
  });
});
