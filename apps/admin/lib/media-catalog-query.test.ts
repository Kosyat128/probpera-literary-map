import { describe, expect, it } from "vitest";

import {
  MEDIA_CATALOG_PAGE_SIZE,
  mediaCatalogPageHref,
  parseMediaCatalogQuery,
} from "./media-catalog-query";

describe("media catalog search and pagination", () => {
  it("uses an allowlisted database column and stable range", () => {
    expect(
      parseMediaCatalogQuery({ q: "Толстой", search_field: "creator", page: "3" })
    ).toMatchObject({
      term: "Толстой",
      field: "creator",
      column: "creator",
      page: 3,
      from: MEDIA_CATALOG_PAGE_SIZE * 2,
      to: MEDIA_CATALOG_PAGE_SIZE * 3 - 1,
    });
    expect(
      parseMediaCatalogQuery({ search_field: "deleted_at;drop table", page: "1" })
    ).toMatchObject({ field: "alt", column: "alt_text" });
  });

  it("escapes SQL LIKE wildcards and removes control characters", () => {
    expect(parseMediaCatalogQuery({ q: "  100%_cover\u0000  " })).toMatchObject({
      term: "100%_cover",
      pattern: "%100\\%\\_cover%",
    });
  });

  it("bounds invalid page values", () => {
    expect(parseMediaCatalogQuery({ page: "-200" }).page).toBe(1);
    expect(parseMediaCatalogQuery({ page: "999999999" }).page).toBe(10_000);
    expect(parseMediaCatalogQuery({ page: "1.5" }).page).toBe(1);
  });

  it("preserves a canonical filter in page and action links", () => {
    const query = parseMediaCatalogQuery({
      q: "обложка",
      search_field: "collection",
      state: "unused",
      view: "list",
      page: 2,
    });
    expect(mediaCatalogPageHref(query, 3)).toBe(
      "/media?q=%D0%BE%D0%B1%D0%BB%D0%BE%D0%B6%D0%BA%D0%B0&search_field=collection&state=unused&view=list&page=3"
    );
    expect(mediaCatalogPageHref(query, 2, { saved: "1" })).toContain("saved=1");
    expect(mediaCatalogPageHref(query, 2, {
      saved: "bulk",
      bulkCount: 4,
      skippedCount: 1,
      orphanCount: 2,
    })).toContain("bulk_count=4&skipped_count=1&orphan_count=2");
  });

  it("allowlists the Media Studio lifecycle state", () => {
    expect(parseMediaCatalogQuery({ state: "trash" }).state).toBe("trash");
    expect(parseMediaCatalogQuery({ state: "unused" }).state).toBe("unused");
    expect(parseMediaCatalogQuery({ state: "trash;drop table" }).state).toBe("active");
  });

  it("allowlists and preserves the list/grid presentation", () => {
    expect(parseMediaCatalogQuery({ view: "list" }).view).toBe("list");
    expect(parseMediaCatalogQuery({ view: "cards;drop table" }).view).toBe("grid");
    expect(mediaCatalogPageHref(parseMediaCatalogQuery({ view: "list" }), 1))
      .toBe("/media?view=list");
  });
});
