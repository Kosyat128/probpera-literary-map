import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");
const migration = read("supabase/migrations/20260901_zzz_admin_mutation_guards.sql");
const siteCopy = read("apps/admin/app/(dashboard)/site-copy/actions.ts");
const inlineCopy = read("apps/admin/app/(dashboard)/site-copy/inline-actions.ts");
const seo = read("apps/admin/app/(dashboard)/seo/actions.ts");
const comments = read("apps/admin/app/(dashboard)/comments/actions.ts");
const commentsPage = read("apps/admin/app/(dashboard)/comments/page.tsx");

describe("Phase 8 atomic admin mutation guards", () => {
  it("saves both Site Copy entry points through one CAS and audit transaction", () => {
    expect(migration).toContain("create or replace function public.save_site_copy_block(");
    expect(migration).toContain("SITE_COPY_WRITE_CONFLICT");
    expect(migration).toContain("insert into public.admin_audit_log");
    expect(siteCopy).toContain('.rpc(\n    "save_site_copy_block"');
    expect(inlineCopy).toContain('.rpc(\n    "save_site_copy_block"');
    expect(siteCopy).not.toContain('.from("admin_audit_log")');
    expect(inlineCopy).not.toContain('.from("admin_audit_log")');
    for (const operation of ["insert", "update", "delete"]) {
      expect(migration).toContain(`create policy "Site Copy ${operation} requires guarded RPC"`);
    }
    expect(migration.match(/as restrictive for (?:insert|update|delete) to authenticated/gu)).toHaveLength(3);
    expect(migration).toMatch(/Site Copy update requires guarded RPC[\s\S]*?using \([\s\S]*?with check \(/u);
    expect(migration.match(/site-copy-overrides/gu)).toHaveLength(6);
  });

  it("makes redirects RPC-only and rejects collisions, chains, loops, and stale writes", () => {
    expect(migration).toContain('drop policy if exists "Staff manage redirects"');
    expect(migration).toMatch(/revoke insert, update, delete on table public\.redirects/u);
    for (const code of [
      "REDIRECT_SELF_REFERENCE", "REDIRECT_COLLISION_OR_CHAIN",
      "REDIRECT_LIVE_ROUTE_COLLISION", "REDIRECT_SOURCE_EXISTS",
      "REDIRECT_WRITE_CONFLICT",
    ]) expect(migration).toContain(code);
    expect(migration.match(/pg_advisory_xact_lock\(188654771, 3\)/gu)).toHaveLength(3);
    expect(seo).not.toMatch(/\.from\("redirects"\)\s*\.(?:insert|update|delete)/u);
    expect(seo).not.toContain("error.message }");
  });

  it("moderates one or up to 100 comments atomically with CAS, audit, and bulk UI", () => {
    expect(migration).toContain("create or replace function public.moderate_comments_guarded(");
    expect(migration).toContain("COMMENT_WRITE_CONFLICT");
    expect(migration).toContain("requested_count > 100");
    expect(comments).toContain('supabase.rpc("moderate_comments_guarded"');
    expect(comments).not.toContain('.from("admin_audit_log")');
    expect(commentsPage).toContain("bulkModerateCommentsAction");
    expect(commentsPage).toContain('name="selected_comment"');
    expect(migration).toMatch(/revoke update, delete on table public\.article_comments\s+from public, anon, authenticated/u);
    expect(migration).toContain("grant update (body) on table public.article_comments to authenticated");
    expect(migration).toMatch(/create policy "Authors manage their comments"[\s\S]*?author_id = \(select auth\.uid\(\)\)/u);
    const authorPolicy = migration.match(/create policy "Authors manage their comments"[\s\S]*?with check \([\s\S]*?\);/u)?.[0] ?? "";
    expect(authorPolicy).not.toContain("is_community_moderator");
    expect(migration).toContain("drop trigger if exists article_comments_set_updated_at");
    expect(migration).toContain("create trigger article_comments_set_updated_at");
  });

  it("resets RPC ACLs before granting only authenticated execution", () => {
    expect(migration.match(/revoke all on function public\./gu)).toHaveLength(6);
    expect(migration.match(/grant execute on function public\./gu)).toHaveLength(5);
    expect(migration).not.toMatch(/grant execute[\s\S]*?to anon/u);
  });
});
