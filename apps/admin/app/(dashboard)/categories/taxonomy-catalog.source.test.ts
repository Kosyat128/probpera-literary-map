import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260813_tags_updated_at.sql"),
  "utf8"
);

describe("taxonomy catalog concurrency and pagination wiring", () => {
  it("uses a counted, filtered, stable range for the complete tag catalog", () => {
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("tagsRequest.or(catalog.orFilter)");
    expect(pageSource).toContain('.order("name", { ascending: true })');
    expect(pageSource).toContain('.order("id", { ascending: true })');
    expect(pageSource).toContain("tagsRequest.range(catalog.from, catalog.to)");
    expect(pageSource).not.toContain(".limit(200)");
  });

  it("requires the rendered version for both update and delete", () => {
    expect(actionsSource.split('.eq("updated_at",').length - 1).toBe(2);
    expect(pageSource).toContain('name="expected_updated_at" value={category.updated_at}');
    expect(pageSource).toContain('name="expected_updated_at" value={tag.updated_at}');
    expect(actionsSource).toContain("уже изменён в другой вкладке");
    expect(actionsSource).toContain("уже изменён или удалён");
  });

  it("preserves tag filters and returns the actual publication state for every mutation", () => {
    expect(pageSource).toContain('name="catalog_q"');
    expect(pageSource).toContain('name="catalog_page"');
    expect(actionsSource).toContain("`${kind.data}.created`");
    expect(actionsSource).toContain("`${identity.data.kind}.updated`");
    expect(actionsSource).toContain("`${parsed.data.kind}.deleted`");
    expect(actionsSource.split("published: publication").length - 1).toBe(3);
    expect(pageSource).toContain('query.published === "started"');
    expect(pageSource).toContain('query.published === "queued"');
    expect(pageSource).toContain('query.published === "queue-error"');
  });

  it("adds a non-null tag version and automatic update trigger", () => {
    expect(migrationSource).toContain("add column if not exists updated_at timestamptz");
    expect(migrationSource).toContain("alter column updated_at set not null");
    expect(migrationSource).toContain("create trigger tags_set_updated_at");
    expect(migrationSource).toContain("execute function public.set_updated_at()");
  });
});
