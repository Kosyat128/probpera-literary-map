import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

describe("article editor panel source contracts", () => {
  it("composes the panels in ArticleEditor without replacing media ownership", () => {
    const articleEditor = source("../ArticleEditor.tsx");

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
    expect(articleEditor).toContain("editorMedia.handleDrop(event)");
    expect(articleEditor).toContain("<EditorMediaDialog");
    expect(articleEditor).toContain('name="cover_alt"');
    expect(articleEditor).toContain('name="seo_title"');
    expect(articleEditor).toContain('name="sources"');
    expect(articleEditor).toContain('name="bibliography"');
  });

  it("preserves the existing uncontrolled and named form fields", () => {
    const cover = source("./CoverEditor.tsx");
    const seo = source("./SeoPanel.tsx");
    const checklist = source("./ValidationChecklist.tsx");

    expect(cover).toContain('name="cover_external_url"');
    expect(seo).toContain('name="legacy_path"');
    expect(seo).toContain("defaultValue={legacyPath}");
    expect(seo).toContain('name="allow_indexing"');
    expect(seo).toContain("defaultChecked={allowIndexing}");
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
