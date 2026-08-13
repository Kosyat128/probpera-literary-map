import { describe, expect, it } from "vitest";

import {
  PAGE_CATALOG_PAGE_SIZE,
  pageCatalogFromForm,
  pageCatalogHref,
  pageEditorHref,
  parsePageCatalogQuery,
} from "./page-catalog-query";

describe("page catalog query", () => {
  it("allows only known statuses and creates a bounded range", () => {
    expect(parsePageCatalogQuery({ q: "  О   проекте ", status: "published", page: 3 })).toMatchObject({
      term: "О проекте",
      status: "published",
      from: PAGE_CATALOG_PAGE_SIZE * 2,
      to: PAGE_CATALOG_PAGE_SIZE * 3 - 1,
    });
    expect(parsePageCatalogQuery({ status: "deleted", page: -4 })).toMatchObject({ status: "", page: 1 });
  });

  it("escapes LIKE wildcards and preserves canonical editor context", () => {
    const catalog = parsePageCatalogQuery({ q: "100%_страница", status: "draft", page: 2 });
    expect(catalog.pattern).toBe("%100\\%\\_страница%");
    expect(pageCatalogHref(catalog, { page: 4 })).toBe(
      "/pages?q=100%25_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0&status=draft&page=4"
    );
    expect(pageEditorHref("page-id", catalog, { saved: "1", revisionPage: 3 })).toContain(
      "/pages/page-id?q="
    );
    expect(pageEditorHref("page-id", catalog, { revisionPage: 3 })).toContain("revision_page=3");
  });

  it("reads context only from canonical hidden inputs", () => {
    const values = new Map<string, unknown>([
      ["catalog_q", "Контакты"],
      ["catalog_status", "hidden"],
      ["catalog_page", "7"],
    ]);
    expect(pageCatalogFromForm({ get: (name) => values.get(name) })).toMatchObject({
      term: "Контакты",
      status: "hidden",
      page: 7,
    });
  });
});
