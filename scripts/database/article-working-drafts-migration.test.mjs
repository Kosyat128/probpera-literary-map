import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260902_article_working_drafts.sql", import.meta.url),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("published article working-draft migration", () => {
  it("creates one bounded, versioned working copy per article", () => {
    expect(sql).toContain("create table if not exists public.article_working_drafts");
    expect(sql).toContain("article_id uuid primary key");
    expect(sql).toContain("base_article_updated_at timestamptz not null");
    expect(sql).toContain("payload jsonb not null");
    expect(sql).toContain("english_payload jsonb not null");
    expect(sql).toContain("english_payload = '{\"mode\":\"disabled\"}'::jsonb");
    expect(sql).toContain("english_payload ->> 'mode' = 'save'");
    expect(sql).toContain("expected_english_updated_at timestamptz");
    expect(sql).toContain("version bigint not null default 1");
    expect(sql.match(/octet_length\([^)]*payload::text\) <= 5242880/gu)).toHaveLength(2);
    expect(sql.match(/octet_length\([^)]*payload::text\) > 5242880/gu)).toHaveLength(2);
    expect(sql).toContain("actor_id uuid not null references auth.users(id)");
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("updated_at timestamptz not null default now()");
  });

  it("forces staff-read-only RLS and closes direct authenticated writes", () => {
    expect(sql).toContain("alter table public.article_working_drafts force row level security");
    expect(sql).toContain("revoke all on table public.article_working_drafts from public, anon, authenticated");
    expect(sql).toContain("grant select on table public.article_working_drafts to authenticated");
    expect(sql).toContain('create policy "Staff read article working drafts"');
    expect(sql).toContain("for select to authenticated");
    const workingDraftPolicies = sql.slice(
      sql.indexOf('drop policy if exists "Staff read article working drafts"'),
      sql.indexOf("create or replace function public.save_article_working_draft")
    );
    expect(workingDraftPolicies).not.toMatch(
      /for (?:insert|update|delete|all) to authenticated/iu
    );
  });

  it("keeps editors on private draft/review rows at the database boundary", () => {
    expect(sql).toContain('drop policy if exists "Staff create articles"');
    expect(sql).toContain('drop policy if exists "Staff update articles"');
    const articlePolicies = sql.slice(
      sql.indexOf('drop policy if exists "Staff create articles"'),
      sql.indexOf("-- Apply the same release boundary to article translations")
    );
    expect(articlePolicies).toContain("public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])");
    expect(articlePolicies).toContain("public.is_staff(array['editor'::public.staff_role])");
    expect(articlePolicies.match(/status in \('draft', 'review'\)/gu)).toHaveLength(3);
  });

  it("keeps editor translation writes inside unpublished draft/review parents", () => {
    const translationPolicies = sql.slice(
      sql.indexOf('drop policy if exists "Staff create article translations"'),
      sql.indexOf('drop policy if exists "Staff read article working drafts"')
    );
    expect(translationPolicies).toContain(
      'create policy "Staff create article translations"'
    );
    expect(translationPolicies).toContain(
      'create policy "Staff update article translations"'
    );
    expect(translationPolicies).toContain(
      "public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])"
    );
    expect(translationPolicies).toContain(
      "public.is_staff(array['editor'::public.staff_role])"
    );
    expect(translationPolicies.match(/parent_article\.status in \('draft', 'review'\)/gu)).toHaveLength(3);
    expect(translationPolicies).toContain("status in ('draft', 'review', 'stale')");
    expect(translationPolicies).not.toMatch(
      /status in \([^)]*(?:approved|published|archived)/iu
    );
    expect(translationPolicies).toContain("created_by = (select auth.uid())");
    expect(translationPolicies.match(/updated_by = \(select auth\.uid\(\)\)/gu)).toHaveLength(2);
    for (const releaseColumn of ["approved_by", "approved_at", "published_at"]) {
      expect(translationPolicies.match(new RegExp(`${releaseColumn} is null`, "gu"))).toHaveLength(2);
    }
  });

  it("saves through exact article, English and draft CAS boundaries", () => {
    expect(sql).toContain("create or replace function public.save_article_working_draft(");
    expect(sql).toContain("actor is null or not public.is_staff()");
    expect(sql).toContain("current_article.status is distinct from 'published'::public.article_status");
    expect(sql).toContain("current_article.updated_at is distinct from p_base_article_updated_at");
    expect(sql).toContain("and translation.deleted_at is null");
    expect(sql).toContain("current_english_updated_at is distinct from p_expected_english_updated_at");
    expect(sql).toContain("current_draft.version is distinct from p_expected_version");
    expect(sql).toContain("where article_id = p_article_id and version = p_expected_version");
    expect(sql.match(/for update;/gu).length).toBeGreaterThanOrEqual(4);
    for (const message of [
      "staff-required",
      "working-draft-invalid",
      "published-article-required",
      "article-version-conflict",
      "english-version-conflict",
      "working-draft-version-conflict",
    ]) expect(sql).toContain(`message = '${message}'`);
  });

  it("clears a draft transactionally after every privileged release status", () => {
    expect(sql).toContain("create or replace function public.clear_article_working_draft_after_promotion()");
    expect(sql).toContain("after update on public.articles");
    expect(sql).toContain(
      "when (new.status in ('published', 'scheduled', 'hidden', 'archived'))"
    );
    expect(sql).toContain("delete from public.article_working_drafts where article_id = new.id");
  });

  it("promotes with article-first locking and an exact working-draft CAS", () => {
    expect(sql).toContain(
      "create or replace function public.promote_article_working_draft("
    );
    expect(sql).toContain("p_expected_working_draft_version bigint");
    const promotion = sql.slice(
      sql.indexOf("create or replace function public.promote_article_working_draft("),
      sql.indexOf("drop trigger if exists articles_guard_working_draft_promotion")
    );
    expect(promotion.indexOf("from public.articles article"))
      .toBeLessThan(promotion.indexOf("from public.article_working_drafts draft"));
    expect(promotion).toContain("p_expected_working_draft_version = 0");
    expect(promotion).toContain("p_expected_working_draft_version > 0");
    expect(promotion).toContain("message = 'WORKING_DRAFT_CONFLICT'");
    expect(promotion).toContain("perform set_config(");
    expect(promotion).toContain("probpera.expected_working_draft_promotion");
    expect(promotion).toContain("from public.save_article_bundle(");
    expect(promotion).toContain("security invoker\nset search_path = ''");
    expect(sql).toContain("create trigger articles_guard_working_draft_promotion");
    expect(sql).toContain("before update on public.articles");
    expect(sql).toContain(
      "expected_promotion is distinct from\n    (new.id::text || ':' || current_draft_version::text)"
    );
  });

  it("uses fail-closed SECURITY DEFINER ACLs for save and discard", () => {
    expect(sql.match(/security definer\nset search_path = ''/gu)).toHaveLength(4);
    expect(sql).toContain("create or replace function public.discard_article_working_draft(");
    expect(sql).toContain("revoke all on function public.save_article_working_draft(");
    expect(sql).toContain("revoke all on function public.discard_article_working_draft(uuid, bigint)");
    expect(sql).toContain("revoke all on function public.promote_article_working_draft(");
    expect(sql).toContain("revoke all on function public.guard_article_working_draft_promotion()");
    expect(sql).toContain(") to authenticated;");
    expect(sql).not.toContain("raise exception saved");
  });

  it("audits working-draft saves and discards without storing their content", () => {
    expect(sql).toContain("'article.working_draft.saved'");
    expect(sql).toContain("'article.working_draft.discarded'");
    expect(sql).toContain("'baseArticleUpdatedAt', saved.base_article_updated_at");
    expect(sql).not.toContain("'payload', saved.payload");
  });
});
