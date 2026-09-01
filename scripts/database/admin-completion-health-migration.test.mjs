import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260901_zzzzzz_admin_completion_health.sql"
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");

const completionFlags = [
  "visualDirectEditV2",
  "staffOwnerInvariant",
  "dataStudioIntegrity",
  "translationOperations",
  "adminMutationGuards",
  "adminAnalyticsReporting",
  "adminOpsObservability",
];

describe("final admin schema health migration", () => {
  it("extends the complete predecessor health contract idempotently", () => {
    expect(migration).toContain(
      "get_editorial_schema_health_pre_admin_completion()"
    );
    expect(migration).toContain(
      "alter function public.get_editorial_schema_health()"
    );
    expect(migration).toContain(
      "rename to get_editorial_schema_health_pre_admin_completion"
    );
    expect(migration).toContain(
      "'version', '20260901_zzzzzz_admin_completion_health'"
    );
    for (const flag of completionFlags) {
      expect(migration).toContain(`'${flag}',`);
    }
  });

  it("certifies the protected schema and authorization boundaries", () => {
    expect(migration).toContain("public.get_data_studio_schema_health()");
    expect(migration).toContain("public.translation_operations_ready()");
    expect(migration).toContain("policy.permissive = 'RESTRICTIVE'");
    expect(migration).toContain("has_column_privilege(");
    expect(migration).toContain("public.admin_ops_markers");
    expect(migration).toContain("relation.relforcerowsecurity");
    expect(migration).toContain("public.get_admin_analytics_report");
  });

  it("keeps the public probe staff-only and fail-closed", () => {
    expect(migration).toContain("select case when public.is_staff() then");
    expect(migration).toContain("else null");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.get_editorial_schema_health()"
    );
    expect(migration).toContain(
      "grant execute on function public.get_editorial_schema_health()\n  to authenticated;"
    );
    expect(migration).not.toMatch(/\bdrop\s+(?:table|schema|column)\b/iu);
    expect(migration).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
  });
});
