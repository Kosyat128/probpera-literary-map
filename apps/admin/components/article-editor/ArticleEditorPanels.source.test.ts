import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

describe("article editor panel source contracts", () => {
  it("composes the panels in ArticleEditor without replacing media ownership", () => {
    const articleEditor = source("../ArticleEditor.tsx");
    const shell = source("./ArticleEditorShell.tsx");

    for (const component of [
      "PublishPanel",
      "CoverEditor",
      "SeoPanel",
      "ValidationChecklist",
      "SourceBibliographyEditor",
    ]) {
      expect(articleEditor).toContain(`<${component}`);
    }
    expect(articleEditor).toContain("useArticleValidation({");
    expect(articleEditor).toContain(
      'activeLocale === "en" ? englishWordCount : russianWordCount'
    );
    expect(articleEditor).not.toContain("const countHtmlWords =");
    expect(articleEditor).toContain("handleEditorDrop: editorMedia.handleDrop");
    expect(articleEditor).toContain("<EditorMediaDialog");
    expect(shell).toContain('name="cover_alt"');
    expect(shell).toContain('name="seo_title"');
    expect(shell).toContain('name="sources"');
    expect(shell).toContain('name="bibliography"');
  });

  it("preserves named form fields while keeping recovered values controlled", () => {
    const cover = source("./CoverEditor.tsx");
    const seo = source("./SeoPanel.tsx");
    const checklist = source("./ValidationChecklist.tsx");

    expect(cover).toContain('name="cover_external_url"');
    expect(seo).toContain('name="legacy_path"');
    expect(seo).toContain("value={legacyPath}");
    expect(seo).toContain("onLegacyPathChange(event.target.value)");
    expect(seo).toContain('name="allow_indexing"');
    expect(seo).toContain("checked={allowIndexing}");
    expect(seo).toContain("onAllowIndexingChange(event.target.checked)");
    expect(checklist).toContain('name="publication_ready"');
  });

  it("keeps Russian source invalidation explicit and does not own media saving", () => {
    const files = [
      source("./CoverEditor.tsx"),
      source("./SeoPanel.tsx"),
      source("./SourceBibliographyEditor.tsx"),
    ];
    const combined = files.join("\n");

    expect(combined).toContain('locale === "ru"');
    expect(combined).toContain("markRussianSourceChanged()");
    expect(combined).not.toMatch(/editor-image-upload|\/api\/media\/upload/iu);
    expect(combined).not.toMatch(/saveArticleAction|actions-legacy/iu);
  });
});
