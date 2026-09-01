import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("complete comments catalog wiring", () => {
  it("uses exact counted pagination and stable ordering", () => {
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("request.range(catalog.from, catalog.to)");
    expect(pageSource).toContain('.order("id", { ascending: false })');
    expect(pageSource).not.toContain(".limit(200)");
  });

  it("uses parsed allowlisted status and escaped text search", () => {
    expect(pageSource).toContain("const query = await searchParams");
    expect(pageSource).toContain("parseCommentsCatalogQuery(query)");
    expect(pageSource).toContain("request.eq(\"status\", catalog.status)");
    expect(pageSource).toContain("request.or(catalog.orFilter)");
    expect(pageSource).toContain("commentsCatalogHref(catalog, catalog.page + 1)");
  });

  it("rejects stale moderation forms and preserves catalog context", () => {
    expect(pageSource).toContain('name="expected_updated_at"');
    expect(pageSource).toContain('name="catalog_q"');
    expect(actionsSource).toContain('supabase.rpc("moderate_comments_guarded"');
    expect(actionsSource).toContain("expectedUpdatedAt");
    expect(actionsSource).toContain("p_items:");
    expect(actionsSource).toContain("commentsCatalogFormHref(formData, notice)");
    expect(actionsSource).not.toMatch(/\.from\("article_comments"\)\s*\.update/u);
  });
});
