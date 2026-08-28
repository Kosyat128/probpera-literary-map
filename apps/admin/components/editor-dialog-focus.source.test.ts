import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const focusSource = source("./useEditorDialogFocus.ts");
const dialogSources = [
  source("./EditorLinkDialog.tsx"),
  source("./EditorMediaDialog.tsx"),
  source("./rich-editor/EditorImageDialog.tsx"),
  source("./article-editor/GalleryEditor.tsx"),
];

describe("shared editor dialog focus contract", () => {
  it("traps Tab, closes on Escape and restores the opening control", () => {
    expect(focusSource).toContain('event.key !== "Tab"');
    expect(focusSource).toContain('event.key === "Escape"');
    expect(focusSource).toContain("returnFocus.focus({ preventScroll: true })");
  });

  it("is connected to every shared editor dialog", () => {
    for (const dialogSource of dialogSources) {
      expect(dialogSource).toContain("useEditorDialogFocus({");
      expect(dialogSource).toContain("ref={dialogRef}");
      expect(dialogSource).toContain("onKeyDown={onDialogKeyDown}");
      expect(dialogSource).toContain("data-editor-dialog-initial-focus");
      expect(dialogSource).toContain('aria-modal="true"');
      expect(dialogSource).not.toContain("autoFocus");
    }
  });
});
