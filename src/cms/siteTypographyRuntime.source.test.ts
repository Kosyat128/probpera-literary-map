import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("public typography runtime contract", () => {
  it("updates page and template context after client navigation", () => {
    const runtime = source("./SiteTypographyRuntime.tsx");
    expect(runtime).toContain("document.body.dataset.typographyPage");
    expect(runtime).toContain("document.body.dataset.typographyTemplate");
    expect(runtime).toContain('window.addEventListener("popstate", syncContext)');
    expect(runtime).toContain(
      'window.addEventListener("probpera:navigation", syncContext)'
    );
    expect(runtime).toContain('window.removeEventListener("popstate", syncContext)');
  });

  it("marks real public component roots for component-layer rules", () => {
    expect(source("../App.tsx")).toContain(
      'data-typography-component="magazine"'
    );
    expect(source("../components/ArticleReader.tsx")).toContain(
      'data-typography-component="article-reader"'
    );
    expect(source("../components/ArticleReader.tsx")).toContain(
      "data-typography-instance={cmsTypographyTargetKey(`article-${article.id}`)}"
    );
    expect(source("../components/ArticleLibrarySection.tsx")).toContain(
      'data-typography-component="journal"'
    );
    expect(source("../components/CmsPageReader.tsx")).toContain(
      'data-typography-component="cms-page-reader"'
    );
    expect(source("../components/CmsPageReader.tsx")).toContain(
      "data-typography-instance={cmsTypographyTargetKey(`page-${page.slug}`)}"
    );
  });
});
