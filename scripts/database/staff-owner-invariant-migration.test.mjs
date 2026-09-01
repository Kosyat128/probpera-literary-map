import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const migration = read(
  "supabase/migrations/20260901_zz_staff_owner_invariant.sql"
);
const actions = read("apps/admin/app/(dashboard)/settings/actions.ts");

describe("Phase 8 staff owner invariant", () => {
  it("removes direct membership writes and leaves one read-only RLS policy", () => {
    expect(migration).toContain("alter table public.staff_memberships force row level security");
    expect(migration).toContain('drop policy if exists "Owners manage staff"');
    expect(migration).toContain('create policy "Staff read their membership"');
    expect(migration).toMatch(
      /revoke all on table public\.staff_memberships from public, anon, authenticated;/u
    );
    expect(migration).not.toMatch(/create policy "Owners manage staff"/u);
  });

  it("serializes both compatible RPCs and enforces the last-owner invariant", () => {
    expect(migration.match(/pg_advisory_xact_lock\(188654771, 1\)/gu)).toHaveLength(2);
    expect(migration.match(/for update;/gu)).toHaveLength(2);
    expect(migration.match(/message = 'STAFF_LAST_OWNER'/gu)).toHaveLength(2);
    expect(migration).toContain(
      "create or replace function public.owner_set_staff_member("
    );
    expect(migration).toContain(
      "create or replace function public.owner_remove_staff_member(p_user_id uuid)"
    );
  });

  it("writes audit rows in the same RPC transactions and applies strict ACLs", () => {
    expect(migration.match(/insert into public\.admin_audit_log/gu)).toHaveLength(2);
    expect(migration).toContain("'staff.updated'");
    expect(migration).toContain("'staff.removed'");
    expect(migration).toMatch(
      /revoke all on function public\.owner_set_staff_member[\s\S]*?from public, anon, authenticated;/u
    );
    expect(migration).toMatch(
      /grant execute on function public\.owner_remove_staff_member\(uuid\)[\s\S]*?to authenticated;/u
    );
  });

  it("keeps audit out of the action and maps RPC errors to stable safe copy", () => {
    expect(actions).not.toContain('.from("admin_audit_log")');
    for (const code of [
      "STAFF_LAST_OWNER",
      "STAFF_MEMBER_NOT_FOUND",
      "STAFF_OWNER_REQUIRED",
      "STAFF_SELF_REMOVE_FORBIDDEN",
      "STAFF_USER_NOT_REGISTERED",
    ]) {
      expect(actions).toContain(code);
    }
    expect(actions).not.toContain("encodeURIComponent(error.message)");
  });
});
