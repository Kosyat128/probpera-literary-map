import { describe, expect, it } from "vitest";

import {
  COMMENTS_CATALOG_PAGE_SIZE,
  commentsCatalogHref,
  parseCommentsCatalogQuery,
} from "./comments-catalog-query";

describe("comments catalog query", () => {
  it("normalizes filters and produces a stable page range", () => {
    expect(parseCommentsCatalogQuery({ q: "  роман  ", status: "pending", page: "3" }))
      .toMatchObject({
        term: "роман",
        status: "pending",
        page: 3,
        from: COMMENTS_CATALOG_PAGE_SIZE * 2,
        to: COMMENTS_CATALOG_PAGE_SIZE * 3 - 1,
      });
  });

  it("rejects unknown statuses and escapes PostgREST wildcards", () => {
    const catalog = parseCommentsCatalogQuery({ q: "100%_", status: "deleted" });
    expect(catalog.status).toBe("");
    expect(catalog.orFilter).toContain('body.ilike."');
    expect(catalog.orFilter).toContain("100\\\\%\\\\_");
    expect(catalog.orFilter).not.toContain("body.ilike.%100");
  });

  it("preserves active filters in pagination links", () => {
    const catalog = parseCommentsCatalogQuery({ q: "Пушкин", status: "hidden", page: 2 });
    expect(commentsCatalogHref(catalog, 3)).toBe(
      "/comments?q=%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD&status=hidden&page=3"
    );
  });
});
