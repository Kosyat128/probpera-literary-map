import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../../../../../supabase/migrations/20260813_unified_revision_history.sql", import.meta.url),
  "utf8"
);

describe("complete revision and audit history catalogs", () => {
  it("uses exact counts and independent ranges without fixed limits", () => {
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("revisionsRequest.range(catalog.from, catalog.to)");
    expect(pageSource).toContain("eventsRequest.range(catalog.eventsFrom, catalog.eventsTo)");
    expect(pageSource).not.toContain(".limit(30)");
    expect(pageSource).not.toContain(".limit(60)");
    expect(pageSource).not.toContain(".limit(250)");
  });

  it("applies parsed kind/entity filters and stable created-at/id ordering", () => {
    expect(pageSource).toContain('.eq("kind", catalog.kind)');
    expect(pageSource).toContain('.ilike("search_text", catalog.entityPattern)');
    expect(pageSource).toContain('.order("created_at", { ascending: false })');
    expect(pageSource).toContain('.order("revision_id", { ascending: false })');
    expect(pageSource).toContain('.order("kind", { ascending: true })');
    expect(pageSource).toContain('.order("id", { ascending: false })');
  });

  it("preserves filters around a restore action", () => {
    expect(pageSource).toContain('name="history_kind"');
    expect(pageSource).toContain('name="history_entity"');
    expect(actionsSource).toContain("historyCatalogFormHref(formData, options)");
  });

  it("unifies all revision tables in a staff-only security-invoker view", () => {
    expect(migrationSource).toContain("with (security_invoker = true)");
    expect(migrationSource).toContain("from public.article_revisions revision");
    expect(migrationSource).toContain("from public.book_edition_revisions revision");
    expect(migrationSource).toContain("revoke all on public.admin_revision_history from public, anon");
    expect(migrationSource).toContain("grant select on public.admin_revision_history to authenticated");
  });
});
