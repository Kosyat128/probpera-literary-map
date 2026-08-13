import { describe, expect, it } from "vitest";

import {
  PUBLICATION_CATALOG_PAGE_SIZE,
  parsePublicationCatalogQuery,
  publicationCatalogHref,
} from "./publication-catalog-query";

describe("publication catalog query", () => {
  it("uses allowlisted statuses and a bounded stable range", () => {
    expect(parsePublicationCatalogQuery({ q: "article", status: "failed", page: 4 }))
      .toMatchObject({
        term: "article",
        status: "failed",
        page: 4,
        from: PUBLICATION_CATALOG_PAGE_SIZE * 3,
        to: PUBLICATION_CATALOG_PAGE_SIZE * 4 - 1,
      });
    expect(parsePublicationCatalogQuery({ status: "deleted" }).status).toBe("");
  });

  it("escapes search patterns and preserves catalog context", () => {
    const catalog = parsePublicationCatalogQuery({ q: "100%_", status: "requested", page: 2 });
    expect(catalog.orFilter).toContain('entity_type.ilike."');
    expect(catalog.orFilter).toContain("100\\\\%\\\\_");
    expect(catalog.orFilter).not.toContain("entity_type.ilike.%100");
    expect(publicationCatalogHref(catalog, { page: 3, published: "queued" })).toBe(
      "/publication?q=100%25_&status=requested&page=3&published=queued"
    );
  });
});
