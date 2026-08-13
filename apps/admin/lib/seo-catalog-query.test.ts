import { describe, expect, it } from "vitest";

import {
  SEO_REDIRECT_PAGE_SIZE,
  parseSeoCatalogQuery,
  seoCatalogFormHref,
  seoCatalogHref,
} from "./seo-catalog-query";

describe("SEO redirect catalog query", () => {
  it("allowlists status and code and calculates the server range", () => {
    expect(
      parseSeoCatalogQuery({ status: "inactive", code: "308", page: "3" })
    ).toMatchObject({
      status: "inactive",
      code: "308",
      page: 3,
      from: SEO_REDIRECT_PAGE_SIZE * 2,
      to: SEO_REDIRECT_PAGE_SIZE * 3 - 1,
    });
    expect(parseSeoCatalogQuery({ status: "true);drop", code: "200" })).toMatchObject({
      status: "all",
      code: "all",
    });
  });

  it("builds a quoted search filter that cannot add an OR condition", () => {
    const query = parseSeoCatalogQuery({ q: '/old%_"),is_active.eq.false' });
    expect(query.pattern).toBe('%/old\\%\\_"),is\\_active.eq.false%');
    expect(query.orFilter).toContain('source_path.ilike."');
    expect(query.orFilter).toContain('\\"),is\\\\_active.eq.false');
    expect(query.orFilter).not.toContain("source_path.ilike.%/old");
  });

  it("preserves every filter and truthful publication state", () => {
    const catalog = parseSeoCatalogQuery({
      q: "/old",
      status: "active",
      code: "301",
      page: 2,
    });
    expect(seoCatalogHref(catalog, { saved: "updated", published: "started" })).toBe(
      "/seo?q=%2Fold&status=active&code=301&page=2&saved=updated&published=started"
    );
    expect(
      seoCatalogFormHref(
        {
          get(name) {
            return {
              catalog_q: "/legacy",
              catalog_status: "inactive",
              catalog_code: "302",
              catalog_page: "4",
            }[name];
          },
        },
        { deleted: "1" }
      )
    ).toContain("page=4");
  });
});
