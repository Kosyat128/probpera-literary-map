import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260812_homepage_block_revisions.sql",
    import.meta.url
  ),
  "utf8"
);

describe("homepage visual-edit revision migration", () => {
  it("captures immutable pre-change snapshots behind staff RLS", () => {
    expect(migration).toContain("create table if not exists public.homepage_block_revisions");
    expect(migration).toContain("before update or delete on public.homepage_blocks");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("to_jsonb(old)");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("using (public.is_staff())");
  });
});
