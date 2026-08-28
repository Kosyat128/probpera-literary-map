import { describe, expect, it } from "vitest";

import { mergePublishedArticleCatalog } from "./article-catalog-merge.mjs";

describe("published article catalog merge", () => {
  it("suppresses a retired static fallback while retaining unrelated legacy articles", () => {
    const legacy = [
      {
        id: "page--article--page--books--14",
        url: "https://probpera.ru/read/page-article/page-books/14",
      },
      { id: "legacy-still-public", url: "https://probpera.ru/read/still-public" },
    ];
    const merged = mergePublishedArticleCatalog(legacy, [], [
      {
        cmsId: "cms-00000000-0000-4000-8000-000000000014",
        canonicalPath: "/stati/mnenie-o-knige/withdrawn",
        legacyId: "page--article--page--books--14",
        legacyPath: "/read/page-article/page-books/14",
      },
    ]);
    expect(merged.map((article) => article.id)).toEqual(["legacy-still-public"]);
  });

  it("still replaces a migrated legacy article with its active CMS publication", () => {
    const cms = [
      {
        id: "cms-active",
        legacyId: "legacy-1",
        legacyPath: "/read/legacy-1",
      },
    ];
    expect(
      mergePublishedArticleCatalog(
        [
          { id: "legacy-1", url: "https://probpera.ru/read/legacy-1" },
          { id: "legacy-2", url: "https://probpera.ru/read/legacy-2" },
        ],
        cms
      ).map((article) => article.id)
    ).toEqual(["cms-active", "legacy-2"]);
  });
});
