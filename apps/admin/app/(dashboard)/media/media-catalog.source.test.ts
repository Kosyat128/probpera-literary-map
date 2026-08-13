import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("complete media catalog wiring", () => {
  it("uses counted range pagination instead of a fixed latest-files limit", () => {
    expect(pageSource).toContain('.select("*", { count: "exact" })');
    expect(pageSource).toContain("assetsRequest.range(catalog.from, catalog.to)");
    expect(pageSource).not.toContain(".limit(80)");
    expect(pageSource).toContain("mediaCatalogPageHref(catalog, totalPages)");
  });

  it("searches only through the parsed allowlisted catalog column", () => {
    expect(pageSource).toContain("parseMediaCatalogQuery(query)");
    expect(pageSource).toContain("assetsRequest.ilike(catalog.column, catalog.pattern)");
    expect(pageSource).toContain("Object.entries(mediaCatalogSearchFields)");
  });

  it("returns metadata saves and errors to the active filter and page", () => {
    expect(pageSource).toContain('name="catalog_q"');
    expect(pageSource).toContain('name="catalog_search_field"');
    expect(pageSource).toContain('name="catalog_page"');
    expect(actionsSource).toContain("parseMediaCatalogQuery({");
    expect(actionsSource).toContain("mediaCatalogPageHref(catalog, catalog.page, notice)");
    expect(actionsSource).toContain(
      'catalogTarget({ saved: "1", published: publication.state })'
    );
  });
});
