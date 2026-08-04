import { describe, expect, it } from "vitest";

import {
  articleCatalog,
  mergeArticleCatalog,
  type ArticleCatalogEntry,
} from "./catalog";

function article(
  id: string,
  overrides: Partial<ArticleCatalogEntry> = {}
): ArticleCatalogEntry {
  return {
    id,
    url: `https://probpera.ru/read/${id}`,
    title: id,
    description: "",
    sectionId: "literary-essays",
    sectionLabel: "О литературе",
    publishedLabel: "Опубликовано: 29 июля 2026",
    readingMinutes: 1,
    wordCount: 100,
    headingCount: 0,
    ...overrides,
  };
}

describe("mergeArticleCatalog", () => {
  it("replaces a migrated legacy article with the CMS publication", () => {
    const legacy = [article("legacy-1"), article("legacy-2")];
    const cms = [
      article("cms-1", {
        source: "cms",
        legacyId: "legacy-1",
        slug: "novyy-adres",
      }),
    ];

    expect(mergeArticleCatalog(legacy, cms).map((item) => item.id)).toEqual([
      "cms-1",
      "legacy-2",
    ]);
  });

  it("uses the old public path to prevent duplicate publications", () => {
    const legacy = [
      article("legacy-1", {
        url: "https://probpera.ru/read/page-article/old-material",
      }),
    ];
    const cms = [
      article("cms-1", {
        source: "cms",
        legacyPath: "/read/page-article/old-material/",
      }),
    ];

    expect(mergeArticleCatalog(legacy, cms)).toHaveLength(1);
    expect(mergeArticleCatalog(legacy, cms)[0]?.id).toBe("cms-1");
  });

  it("uses clear current addresses and keeps the old path only as compatibility metadata", () => {
    const migrated = articleCatalog.find((item) => item.legacyPath?.startsWith("/read/"));

    expect(migrated?.url).toMatch(
      /^https:\/\/probpera\.ru\/stati\/[a-z0-9-]+\/[a-z0-9-]+\/$/u
    );
    expect(migrated?.canonicalUrl).toBe(migrated?.url);
    expect(migrated?.legacyPath).toMatch(/^\/read\//u);
  });
});
