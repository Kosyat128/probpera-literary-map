import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relative) => readFileSync(path.join(root, relative), "utf8").replace(/\r\n?/gu, "\n");
const dockerProbe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
  encoding: "utf8",
});
const dockerAvailable = dockerProbe.status === 0;
const integrationTest = dockerAvailable || process.env.CI ? it : it.skip;

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error("Publication fixture migration boundary missing");
  return source.slice(startIndex, endIndex);
}

export function articlePublicationPermissionsSql() {
  const base = read("scripts/database/fixtures/atomic-article-bundle-contract.sql");
  const setup = base.split("-- __ATOMIC_ARTICLE_BUNDLE_MIGRATION__")[0];
  const guards = read("supabase/migrations/20260901_zzz_admin_mutation_guards.sql");
  const redirects = between(
    guards,
    "create or replace function public.assert_redirect_candidate(",
    "create or replace function public.moderate_comments_guarded("
  );
  const redirectAcl = guards.split(/\r?\n/u).filter((line) =>
    /^(?:grant|revoke) .*function public\.(?:assert_redirect_candidate|(?:create|update|delete)_seo_redirect_guarded)\(/u.test(line)
  ).join("\n");
  const fixture = read("scripts/database/fixtures/article-publication-permissions-contract.sql");
  const hotfix = read("supabase/migrations/20260905_article_publication_permissions.sql");
  return `${setup}
create role service_role nologin;
create table public.pages (
  id uuid primary key, slug text, canonical_url text,
  status text, deleted_at timestamptz
);
create or replace function public.capture_public_build_outbox()
returns trigger language plpgsql security definer set search_path = '' as $$
begin return case when tg_op = 'DELETE' then old else new end; end;
$$;
${read("supabase/migrations/20260822_zz_atomic_article_bundle.sql")}
${read("supabase/migrations/20260902_article_working_drafts.sql")}
${redirects}
${redirectAcl}
${fixture.replace("-- __ARTICLE_PUBLICATION_PERMISSIONS_HOTFIX__", () => `${hotfix}\n${hotfix}`)}
`;
}

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", maxBuffer: 12 * 1024 * 1024, ...options });
}

function assertCommand(result, description) {
  if (result.status !== 0) {
    throw new Error(`${description}: ${result.error?.message || result.stderr || result.stdout}`);
  }
}

describe("article publication PostgreSQL permissions", () => {
  integrationTest("reproduces both old permission failures and preserves atomic, role-bound publication after the fix", () => {
    if (!dockerAvailable) throw new Error("Docker is required for the CI publication permissions contract");
    const name = `probpera-publish-permissions-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      const start = docker([
        "run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=publication_permissions",
        process.env.POSTGRES_RLS_TEST_IMAGE || "postgres:17-alpine",
      ], { timeout: 120_000 });
      assertCommand(start, "Starting isolated PostgreSQL");
      started = true;
      let consecutiveReady = 0;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        const ready = docker([
          "exec", name, "psql", "--username=postgres", "--dbname=publication_permissions",
          "--no-psqlrc", "--tuples-only", "--no-align", "--command", "select current_database()",
        ]);
        consecutiveReady = ready.status === 0 && ready.stdout.trim() === "publication_permissions"
          ? consecutiveReady + 1 : 0;
        if (consecutiveReady >= 3) break;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
      }
      if (consecutiveReady < 3) throw new Error("Publication fixture PostgreSQL readiness timed out");
      const result = docker([
        "exec", "--interactive", name, "psql", "--username=postgres", "--dbname=publication_permissions",
        "--no-psqlrc", "--set=ON_ERROR_STOP=1",
      ], { input: articlePublicationPermissionsSql(), timeout: 120_000 });
      assertCommand(result, "Publication permissions contract");
      expect(result.stdout).toContain("LEGACY_DRAFT_LOCK_PERMISSION_FAILURE_CONFIRMED");
      expect(result.stdout).toContain("LEGACY_REDIRECT_PERMISSION_FAILURE_CONFIRMED");
      expect(result.stdout).toContain("ARTICLE_PUBLICATION_PERMISSIONS_OK");
    } finally {
      if (started) docker(["rm", "--force", name], { timeout: 20_000 });
    }
  }, 300_000);
});
