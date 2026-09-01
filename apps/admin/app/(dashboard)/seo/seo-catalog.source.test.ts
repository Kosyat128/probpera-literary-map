import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("complete SEO redirect catalog wiring", () => {
  it("uses safe counted range pagination with stable ordering and all filters", () => {
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("redirectsRequest.or(catalog.orFilter)");
    expect(pageSource).toContain('.eq("is_active", catalog.status === "active")');
    expect(pageSource).toContain('.eq("status_code", Number(catalog.code))');
    expect(pageSource).toContain('.order("created_at", { ascending: false })');
    expect(pageSource).toContain('.order("id", { ascending: false })');
    expect(pageSource).toContain("redirectsRequest.range(catalog.from, catalog.to)");
    expect(pageSource).not.toContain(".limit(100)");
  });

  it("counts article statistics server-side and loads only a small issue preview", () => {
    expect(pageSource.split('head: true').length - 1).toBeGreaterThanOrEqual(3);
    expect(pageSource).toContain(".or(SEO_ISSUES_FILTER)");
    expect(pageSource).toContain(".limit(12)");
    expect(pageSource).not.toContain("const articles =");
  });

  it("provides full-form CAS editing and CAS deletion", () => {
    expect(actionsSource).toContain("export async function updateRedirectAction");
    expect(actionsSource).toContain('supabase.rpc("update_seo_redirect_guarded"');
    expect(actionsSource).toContain('supabase.rpc("delete_seo_redirect_guarded"');
    expect(actionsSource.split("p_expected_updated_at:").length - 1).toBe(2);
    expect(actionsSource).toContain("p_id: identity.data.id");
    expect(actionsSource).toContain(
      "p_expected_updated_at: identity.data.expectedUpdatedAt"
    );
    expect(actionsSource).not.toMatch(
      /\.from\("seo_redirects"\)\s*\.(?:update|delete)\(/u
    );
    expect(pageSource).toContain("action={updateRedirectAction}");
    expect(pageSource).toContain('name="source_path"');
    expect(pageSource).toContain('name="destination_path"');
    expect(pageSource).toContain('name="status_code"');
    expect(pageSource).toContain('name="is_active"');
    expect(pageSource).toContain('name="expected_updated_at"');
  });

  it("preserves all filters and reports publication state for create, update, and delete", () => {
    expect(pageSource).toContain('name="catalog_q"');
    expect(pageSource).toContain('name="catalog_status"');
    expect(pageSource).toContain('name="catalog_code"');
    expect(pageSource).toContain('name="catalog_page"');
    expect(actionsSource).toContain('"redirect.created"');
    expect(actionsSource).toContain('"redirect.updated"');
    expect(actionsSource).toContain('"redirect.deleted"');
    expect(actionsSource.split("published: publication").length - 1).toBe(3);
    expect(pageSource).toContain('query.published === "started"');
    expect(pageSource).toContain('query.published === "queued"');
    expect(pageSource).toContain('query.published === "queue-error"');
  });
});
