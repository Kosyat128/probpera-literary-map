import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260823_staff_opt_in_mfa_rls.sql"),
  "utf8"
);
const digest = createHash("sha256").update(migration).digest("hex");

describe("staff opt-in MFA RLS migration", () => {
  it("requires aal2 only after a staff member enrolled a verified factor", () => {
    expect(migration).toContain("create or replace function public.staff_mfa_session_allowed()");
    expect(migration).toContain("when not public.is_staff() then true");
    expect(migration).toContain("from auth.mfa_factors as factor");
    expect(migration).toContain("factor.status = 'verified'");
    expect(migration).toContain("auth.jwt() ->> 'aal'");
    expect(migration).toContain("= 'aal2'");
    expect(migration).toContain("else true");
  });

  it("uses restrictive policies on both canonical article tables", () => {
    expect(migration).toContain('create policy "Staff opted-in MFA articles"');
    expect(migration).toContain(
      'create policy "Staff opted-in MFA article translations"'
    );
    expect(migration.match(/as restrictive/gu)?.length).toBe(2);
    expect(migration.match(/for all\nto authenticated/gu)?.length).toBe(2);
    expect(
      migration.match(/using \(public\.staff_mfa_session_allowed\(\)\)/gu)?.length
    ).toBe(2);
    expect(
      migration.match(/with check \(public\.staff_mfa_session_allowed\(\)\)/gu)
        ?.length
    ).toBe(2);
  });

  it("keeps the helper callable only where authenticated RLS can use it", () => {
    expect(migration).toContain(
      "revoke all on function public.staff_mfa_session_allowed() from public;"
    );
    expect(migration).toContain(
      "grant execute on function public.staff_mfa_session_allowed() to authenticated;"
    );
  });

  it("prints the exact checksum for guarded production review", () => {
    console.log(`staff_mfa_rls_sha256=${digest}`);
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
  });
});
