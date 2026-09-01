import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/20260901_zzzz_admin_ops_observability.sql"),
  "utf8"
).replace(/\r\n/gu, "\n");
const workflow = readFileSync(
  path.resolve(".github/workflows/backup.yml"),
  "utf8"
).replace(/\r\n/gu, "\n");

describe("admin operations observability", () => {
  it("exposes closed operational markers only to authenticated staff", () => {
    expect(migration).toContain("create table if not exists public.admin_ops_markers");
    expect(migration).toContain("alter table public.admin_ops_markers force row level security");
    expect(migration).toContain("using (public.is_staff())");
    expect(migration).toContain("revoke all on table public.admin_ops_markers");
    expect(migration).toContain("grant select on table public.admin_ops_markers to authenticated");
  });

  it("records backup and restore success only after the real restore drill", () => {
    const restore = workflow.indexOf("Restore application schema into an isolated Supabase database");
    const marker = workflow.indexOf("Record verified backup health markers");
    expect(restore).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(restore);
    expect(workflow).toContain("to_regclass('public.admin_ops_markers') is not null");
    expect(workflow).toContain("'encrypted_backup', 'ok'");
    expect(workflow).toContain("'restore_drill', 'ok'");
  });
});
