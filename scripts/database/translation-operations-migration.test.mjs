import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260901_zz_translation_operations.sql", import.meta.url),
  "utf8"
);

describe("durable translation operations migration", () => {
  it("creates bounded private jobs, items and redacted attempts", () => {
    expect(sql).toContain("create table if not exists public.translation_jobs");
    expect(sql).toContain("create table if not exists public.translation_job_items");
    expect(sql).toContain("create table if not exists public.translation_job_attempts");
    expect(sql).toContain("total_items integer not null default 0 check (total_items between 0 and 500)");
    expect(sql).toContain("max_attempts integer not null default 3 check (max_attempts between 1 and 5)");
    expect(sql).toContain("last_error_code text check");
    expect(sql).not.toMatch(/provider_(?:payload|response|body)|source_(?:text|payload)|raw_error/iu);
  });

  it("enforces staff-only reads and RPC-only writes", () => {
    for (const table of [
      "translation_jobs",
      "translation_job_items",
      "translation_job_attempts",
    ]) {
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
    expect(sql).toContain("using (public.is_staff())");
    expect(sql).toContain("if actor_id is null or not public.is_staff() then");
  });

  it("uses leases, bounded retries and a dead-letter terminal state", () => {
    expect(sql).toContain("for update of item skip locked");
    expect(sql).toContain("lease_expires_at <= now()");
    expect(sql).toContain("next_item_status := 'dead_letter'");
    expect(sql).toContain("next_item_status := 'retry_wait'");
    expect(sql).toContain("new_attempt >= current_item.max_attempts");
  });

  it("reserves worker mutation RPCs for service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.claim_translation_job_items(text,integer,integer)\n  to service_role"
    );
    expect(sql).toContain(
      "grant execute on function public.complete_translation_job_item(\n  uuid,text,boolean,text,text,text,integer,integer,integer\n) to service_role"
    );
    expect(sql).not.toContain(
      "grant execute on function public.claim_translation_job_items(text,integer,integer)\n  to authenticated"
    );
  });

  it("records job creation and cancellation in the audit log", () => {
    expect(sql).toContain("'translation.job.created'");
    expect(sql).toContain("'translation.job.cancel_requested'");
    expect(sql).toContain("insert into public.admin_audit_log");
  });
});
