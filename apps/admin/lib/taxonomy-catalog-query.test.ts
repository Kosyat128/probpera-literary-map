import { describe, expect, it } from "vitest";

import {
  TAXONOMY_TAG_PAGE_SIZE,
  parseTaxonomyCatalogQuery,
  taxonomyCatalogFormHref,
  taxonomyCatalogHref,
} from "./taxonomy-catalog-query";

describe("taxonomy tag catalog query", () => {
  it("normalizes search and calculates a bounded server range", () => {
    expect(parseTaxonomyCatalogQuery({ q: "  русская   проза ", page: "3" })).toMatchObject({
      term: "русская проза",
      page: 3,
      from: TAXONOMY_TAG_PAGE_SIZE * 2,
      to: TAXONOMY_TAG_PAGE_SIZE * 3 - 1,
    });
    expect(parseTaxonomyCatalogQuery({ page: "1.5" }).page).toBe(1);
    expect(parseTaxonomyCatalogQuery({ page: "999999" }).page).toBe(10_000);
  });

  it("quotes PostgREST reserved characters and escapes LIKE wildcards", () => {
    const query = parseTaxonomyCatalogQuery({
      q: '100%_test"),is_visible.eq.false\u0000',
    });
    expect(query.pattern).toBe('%100\\%\\_test"),is\\_visible.eq.false%');
    expect(query.orFilter).toContain('name.ilike."');
    expect(query.orFilter).toContain('\\"),is\\\\_visible.eq.false');
    expect(query.orFilter).not.toContain('name.ilike.%100');
  });

  it("preserves catalog context and publication state", () => {
    const catalog = parseTaxonomyCatalogQuery({ q: "поэзия", page: 2 });
    expect(taxonomyCatalogHref(catalog, { saved: "tag-updated", published: "queued" })).toBe(
      "/categories?q=%D0%BF%D0%BE%D1%8D%D0%B7%D0%B8%D1%8F&page=2&saved=tag-updated&published=queued"
    );
    expect(
      taxonomyCatalogFormHref(
        {
          get(name) {
            return { catalog_q: "поэзия", catalog_page: "4" }[name];
          },
        },
        { deleted: "tag" }
      )
    ).toContain("page=4");
  });
});
