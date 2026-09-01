import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260901_zz_translation_operations_runtime.sql", import.meta.url),
  "utf8"
);

describe("translation operations runtime migration", () => {
  it("persists only redacted self-test state behind staff RLS", () => {
    expect(sql).toContain("create table if not exists public.translation_provider_self_tests");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("configured boolean not null");
    expect(sql).toContain("binding_found boolean not null");
    expect(sql).toContain("test_passed boolean");
    expect(sql).toContain("last_test_at timestamptz");
    expect(sql).toContain("last_error_code text check");
    expect(sql).not.toMatch(/response_(?:body|payload)|raw_error|prompt|source_text/iu);
  });

  it("reserves the cooldown before the provider request and uses a lease", () => {
    expect(sql).toContain("begin_translation_provider_self_test");
    expect(sql).toContain("cooldown_until is not null and current_probe.cooldown_until > now()");
    expect(sql).toContain("test_in_progress = true");
    expect(sql).toContain("lease_token = token");
    expect(sql).toContain("finish_translation_provider_self_test");
    expect(sql).toContain("and lease_expires_at > now()");
  });

  it("records bounded sync runs with durable cursors and terminal statuses", () => {
    expect(sql).toContain("record_translation_sync_run");
    expect(sql).toContain("resume_cursor jsonb");
    expect(sql).toContain("get_translation_job_resume");
    for (const status of [
      "reviewing",
      "conflict",
      "stale",
      "skipped",
      "not-configured",
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain("item_count < 1 or item_count > 500");
  });

  it("keeps the bounded lease worker service-role-only", () => {
    expect(sql).toMatch(
      /revoke all on function public\.claim_translation_job_items\(text,integer,integer\)[\s\S]*?from public, anon, authenticated, service_role;/u
    );
    expect(sql).toMatch(
      /revoke all on function public\.complete_translation_job_item\([\s\S]*?\) from public, anon, authenticated, service_role;/u
    );
    expect(sql).toContain(
      "grant execute on function public.claim_translation_job_items(text,integer,integer)\n  to service_role"
    );
    expect(sql).toContain("has_function_privilege(");
    expect(sql).toContain("'public.create_translation_job(text,text,jsonb,integer)'");
    expect(sql).toContain("'public.finish_translation_provider_self_test(text,uuid,boolean,boolean,boolean,text,integer,text)'");
    expect(sql).not.toContain(
      "grant execute on function public.claim_translation_job_items(text,integer,integer)\n  to authenticated"
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.complete_translation_job_item\([^)]+\) to authenticated/u
    );
  });
});
