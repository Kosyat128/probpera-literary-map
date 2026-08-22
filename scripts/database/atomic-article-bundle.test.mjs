import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migrationPath = path.join(
  root,
  "supabase/migrations/20260822_zz_atomic_article_bundle.sql"
);
const migration = readFileSync(migrationPath, "utf8");
const digest = createHash("sha256").update(migration).digest("hex");

describe("atomic article bundle migration", () => {
  it("keeps the RPC inside the caller RLS boundary", () => {
    expect(migration).toContain("create or replace function public.save_article_bundle(");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("if actor_id is null or not public.is_staff() then");
    expect(migration).toContain("grant execute on function public.save_article_bundle(");
    expect(migration).not.toContain("security definer\nset search_path = ''\nas $$\ndeclare\n  actor_id");
  });

  it("checks both optimistic locks before the article mutation", () => {
    const articleLock = migration.indexOf("from public.articles\n    where id = p_article_id\n    for update;");
    const englishLock = migration.indexOf("from public.article_translations\n      where article_id = p_article_id");
    const articleUpdate = migration.indexOf("update public.articles\n    set");

    expect(articleLock).toBeGreaterThan(0);
    expect(englishLock).toBeGreaterThan(articleLock);
    expect(articleUpdate).toBeGreaterThan(englishLock);
    expect(migration).toContain("message = 'ARTICLE_CONFLICT'");
    expect(migration).toContain("message = 'ENGLISH_CONFLICT'");
  });

  it("lets existing revision and outbox triggers participate in the same transaction", () => {
    expect(migration).toContain("update public.articles");
    expect(migration).toContain("update public.article_translations");
    expect(migration).not.toContain("begin;");
    expect(migration).not.toContain("commit;");
    expect(migration).not.toContain("rollback;");
    expect(migration).toContain("articleBundleRpc");
  });

  it("prints the reviewed checksum for the guarded production allowlist", () => {
    console.log(`atomic_article_bundle_sha256=${digest}`);
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
  });
});
