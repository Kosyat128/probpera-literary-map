import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("optimistic protection for JSON-backed admin edits", () => {
  it.each([
    "apps/admin/app/(dashboard)/visual-entity-actions.ts",
    "apps/admin/app/(dashboard)/site-copy/actions.ts",
    "apps/admin/app/(dashboard)/site-copy/inline-actions.ts",
    "apps/admin/app/(dashboard)/editorial-database/actions.ts",
    "apps/admin/app/(dashboard)/homepage/actions.ts",
    "apps/admin/app/(dashboard)/media/actions.ts",
    "apps/admin/app/(dashboard)/banners/actions.ts",
  ])("guards read-merge-write in %s with updated_at", (filename) => {
    const code = source(filename);
    expect(code).toContain("updated_at");
    expect(code).toContain('.eq("updated_at",');
  });

  it("guards Direct Edit v2 inside its atomic database RPC", () => {
    const action = source(
      "apps/admin/app/(dashboard)/visual-content-actions.ts"
    );
    const migration = source(
      "supabase/migrations/20260901_zz_visual_direct_edit_v2.sql"
    );
    expect(action).toContain("p_expected_updated_at: expectedUpdatedAt");
    expect(migration).toContain("updated_at = p_expected_updated_at");
    expect(migration).toContain("insert into public.admin_audit_log");
  });

  it("keeps anonymous public policies independent from staff-only functions", () => {
    const migrationsDirectory = path.join(root, "supabase/migrations");
    for (const entry of readdirSync(migrationsDirectory)) {
      if (!entry.endsWith(".sql")) continue;
      const filename = `supabase/migrations/${entry}`;
      const sql = source(filename);
      const policyStatements = sql
        .split(/(?=create policy )/gu)
        .map((statement) => statement.split(";", 1)[0])
        .filter((statement) => /create policy /u.test(statement));
      for (const statement of policyStatements) {
        if (!/to\s+anon(?:\s*,\s*authenticated)?/u.test(statement)) continue;
        expect(statement, filename).not.toContain("public.is_staff(");
      }
    }
  });
});
