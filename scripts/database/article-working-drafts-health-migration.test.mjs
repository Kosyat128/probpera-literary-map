import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../../supabase/migrations/20260902_zz_article_working_drafts_health.sql",
    import.meta.url
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("article working-draft schema health migration", () => {
  it("extends the previous staff-only health contract idempotently", () => {
    expect(sql).toContain(
      "get_editorial_schema_health_pre_article_working_drafts()"
    );
    expect(sql).toContain(
      "rename to get_editorial_schema_health_pre_article_working_drafts"
    );
    expect(sql).toContain(
      "'version', '20260902_zz_article_working_drafts_health'"
    );
    expect(sql).toContain("'articleWorkingDrafts',");
  });

  it("certifies the relation, FORCE RLS and the only staff read policy", () => {
    expect(sql).toContain("to_regclass('public.article_working_drafts')");
    expect(sql).toContain("relation.relrowsecurity and relation.relforcerowsecurity");
    expect(sql).toContain("article_working_drafts_payload_size_check");
    expect(sql).toContain("article_working_drafts_english_payload_check");
    expect(sql).toContain("'5242880' in pg_get_constraintdef(payload_bound.oid)");
    expect(sql).toContain("'authenticated', 'public.article_working_drafts', 'SELECT'");
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      expect(sql).toContain(
        `'authenticated', 'public.article_working_drafts', '${privilege}'`
      );
    }
    expect(sql).toContain("policy.policyname = 'Staff read article working drafts'");
    expect(sql).toContain("policy.roles = array['authenticated'::name]");
    expect(sql).toContain("position('is_staff' in coalesce(policy.qual, '')) > 0");
    expect(sql).toContain("and policy.tablename = 'article_working_drafts'\n        )");
  });

  it("certifies callable RPCs, closed trigger-function ACL and cleanup trigger", () => {
    expect(sql).toContain(
      "public.save_article_working_draft(uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone,bigint)"
    );
    expect(sql).toContain("public.discard_article_working_draft(uuid,bigint)");
    expect(sql).toContain("public.clear_article_working_draft_after_promotion()");
    expect(sql).toContain("'articles_clear_working_draft_after_promotion'");
    expect(sql).toContain("cleanup_trigger.tgenabled = 'O'");
    expect(sql).toContain("cleanup_trigger.tgfoid =");
    expect(sql).toContain("and rpc.prosecdef");
    for (const status of ["published", "scheduled", "hidden", "archived"]) {
      expect(sql).toContain(
        `position('${status}' in pg_get_triggerdef(cleanup_trigger.oid)) > 0`
      );
    }
  });

  it("certifies fail-closed working-draft promotion CAS", () => {
    expect(sql).toContain("'articleWorkingDraftPromotionCas',");
    expect(sql).toContain(
      "public.promote_article_working_draft(uuid,timestamp with time zone,bigint,jsonb,text,jsonb,timestamp with time zone,text,text,boolean,text,jsonb,boolean,jsonb)"
    );
    expect(sql).toContain("public.guard_article_working_draft_promotion()");
    expect(sql).toContain("select not promotion_rpc.prosecdef");
    expect(sql).toContain("select promotion_guard.prosecdef");
    expect(sql).toContain("'articles_guard_working_draft_promotion'");
    expect(sql).toContain(
      "position('BEFORE UPDATE' in pg_get_triggerdef(guard_trigger.oid)) > 0"
    );
  });

  it("certifies owner/admin publication and editor draft/review policies", () => {
    expect(sql).toContain("'articlePublicationRbac',");
    expect(sql).toContain("policy.policyname = 'Staff create articles'");
    expect(sql).toContain("policy.policyname = 'Staff update articles'");
    expect(sql).toContain("and policy.cmd in ('INSERT', 'UPDATE')");
    for (const roleOrStatus of ["owner", "admin", "editor", "draft", "review"]) {
      expect(sql).toContain(`position('${roleOrStatus}' in coalesce(`);
    }
  });

  it("certifies translation release RBAC and actor attribution", () => {
    expect(sql).toContain("'articleTranslationRbac',");
    expect(sql).toContain(
      "policy.policyname = 'Staff create article translations'"
    );
    expect(sql).toContain(
      "policy.policyname = 'Staff update article translations'"
    );
    expect(sql).toContain("policy.tablename = 'article_translations'");
    for (const requiredTerm of [
      "created_by",
      "updated_by",
      "owner",
      "admin",
      "editor",
      "draft",
      "review",
      "stale",
      "approved_by",
      "approved_at",
      "published_at",
    ]) {
      expect(sql).toContain(`position('${requiredTerm}' in coalesce(`);
    }
    for (const forbiddenStatus of ["approved", "published", "archived"]) {
      expect(sql).toContain(
        `position('''${forbiddenStatus}''' in coalesce(policy.with_check, '')) = 0`
      );
    }
  });

  it("keeps the public health probe staff-only and fail-closed", () => {
    expect(sql).toContain("select case when public.is_staff() then");
    expect(sql).toContain("else null");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain(
      "revoke all on function public.get_editorial_schema_health()"
    );
    expect(sql).toContain(
      "grant execute on function public.get_editorial_schema_health()\n  to authenticated;"
    );
    expect(sql).not.toMatch(/\bdrop\s+(?:table|schema|column)\b/iu);
    expect(sql).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
  });
});
