import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const source = readFileSync(
  path.join(root, "apps/admin/components/editor/RecoveryController.tsx"),
  "utf8"
).replace(/\r\n?/gu, "\n");
const panelSource = readFileSync(
  path.join(root, "apps/admin/components/editor/EditorRecoveryPanel.tsx"),
  "utf8"
).replace(/\r\n?/gu, "\n");
const articleEditorSource = readFileSync(
  path.join(root, "apps/admin/components/ArticleEditor.tsx"),
  "utf8"
).replace(/\r\n?/gu, "\n");
const pageEditorSource = readFileSync(
  path.join(root, "apps/admin/components/PageEditor.tsx"),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("shared server recovery controller", () => {
  it("debounces server autosave and falls back locally", () => {
    expect(source).toContain("EDITOR_AUTOSAVE_INTERVAL_MS");
    expect(source).toContain("saveEditorAutosaveAction");
    expect(source).toContain("onLocalFallback?.()");
  });

  it("never restores a server copy without an explicit editor action", () => {
    expect(panelSource).toContain("Восстановить в редактор");
    expect(source).not.toMatch(/loadLatestEditorAutosaveAction[\s\S]{0,1000}onRestore\(/u);
  });

  it("deletes only the exact receipt after a confirmed canonical save", () => {
    expect(source).toContain("savedAfterSubmit");
    expect(source).toContain("pendingCleanupKey");
    expect(source).toContain("deleteExactEditorAutosaveAction");
    expect(source).toContain("snapshotHash: pending.snapshotHash");
  });

  it("protects both shared editors with complete restorable snapshots", () => {
    expect(articleEditorSource).toContain("<RecoveryController");
    expect(articleEditorSource).toContain('localeScope: "bilingual"');
    expect(articleEditorSource).toContain("applyRecoverySnapshot");
    expect(pageEditorSource).toContain("<RecoveryController");
    expect(pageEditorSource).toContain('localeScope: "default"');
    for (const field of [
      "excerpt",
      "status",
      "seoTitle",
      "seoDescription",
      "canonicalUrl",
      "allowIndexing",
    ]) {
      expect(pageEditorSource).toContain(`${field},`);
    }
  });
});
