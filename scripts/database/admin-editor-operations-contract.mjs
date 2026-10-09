import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8").replace(/\r\n?/gu, "\n");

function definition(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  const end = source.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing actual predecessor function ${name}`);
  return source.slice(start, end + 4);
}

function tableDefinition(source, name) {
  const start = source.indexOf(`create table if not exists public.${name} (`);
  const end = source.indexOf("\n);", start);
  if (start < 0 || end < 0) throw new Error(`Missing actual Page table ${name}`);
  return source.slice(start, end + 4);
}

// Build an isolated PostgreSQL contract from the actual predecessor producers.
// No environment URI, API key, Supabase client or external database is used.
export function adminEditorOperationsContractSql(options = {}) {
  const base = read("scripts/database/fixtures/atomic-article-bundle-contract.sql");
  const setup = base.split("-- __ATOMIC_ARTICLE_BUNDLE_MIGRATION__")[0];
  const foundation = read("supabase/migrations/20260728_cms_foundation.sql");
  const pagePolicyStart = foundation.indexOf('create policy "Public read published pages"');
  const pagePolicyEnd = foundation.indexOf('create policy "Public read enabled homepage blocks"', pagePolicyStart);
  if (pagePolicyStart < 0 || pagePolicyEnd < 0) throw new Error("Missing actual Page RLS predecessor");
  const pagePolicies = foundation.slice(pagePolicyStart, pagePolicyEnd);
  // The article fixture uses clock_timestamp for multiple writes in a DO block.
  // Pages execute the actual foundation now() body under a fixture-only name;
  // neither the real Page trigger nor any predecessor source is changed.
  const pageTimestamp = definition(foundation, "set_updated_at")
    .replace("public.set_updated_at(", "public.fixture_page_set_updated_at(");
  const guards = read("supabase/migrations/20260901_zzz_admin_mutation_guards.sql");
  const redirects = ["assert_redirect_candidate", "create_seo_redirect_guarded", "update_seo_redirect_guarded"]
    .map((name) => definition(guards, name)).join("\n");
  const redirectAcl = guards.split("\n").filter((line) =>
    /^(?:grant|revoke) .*function public\.(?:assert_redirect_candidate|(?:create|update)_seo_redirect_guarded)\(/u.test(line)
  ).join("\n");
  // An explicit local source override replays the same fixture against the
  // captured predecessor candidate. It never changes a database connection.
  const migration = options.migrationSource === undefined
    ? read("supabase/migrations/20261007_admin_editor_operations.sql")
    : options.migrationSource.replace(/\r\n?/gu, "\n");
  const fixture = read("scripts/database/fixtures/admin-editor-operations-contract.sql");
  if (fixture.split("-- __ADMIN_EDITOR_OPERATIONS_MIGRATION__").length !== 2) {
    throw new Error("Editor operation fixture needs one migration boundary");
  }
  return `${setup}
create role service_role nologin bypassrls;
create type public.page_status as enum ('draft','published','hidden');
${tableDefinition(foundation, "pages")}
${tableDefinition(foundation, "page_revisions")}
alter table public.pages enable row level security;
alter table public.page_revisions enable row level security;
${pagePolicies}
grant select, insert, update, delete on public.pages to authenticated;
grant select on public.page_revisions to authenticated;
${pageTimestamp}
create trigger pages_set_updated_at before update on public.pages
for each row execute function public.fixture_page_set_updated_at();
${read("supabase/migrations/20260730_page_revision_history.sql")}
create trigger pages_public_build_outbox after insert or update or delete on public.pages
for each row execute function public.fixture_capture_outbox();
create or replace function public.capture_public_build_outbox()
returns trigger language plpgsql security definer set search_path = '' as $$
begin return case when tg_op = 'DELETE' then old else new end; end;
$$;
${read("supabase/migrations/20260822_zz_atomic_article_bundle.sql")}
${read("supabase/migrations/20260902_article_working_drafts.sql")}
${redirects}
${redirectAcl}
revoke insert, update, delete on public.redirects from authenticated;
${read("supabase/migrations/20260905_article_publication_permissions.sql")}
create or replace function public.fixture_apply_migration()
returns void language plpgsql security invoker as $fixture_apply$
begin execute $fixture_actual_migration$${migration}$fixture_actual_migration$; end;
$fixture_apply$;
create or replace function public.fixture_apply_invalid_migration()
returns void language plpgsql security invoker as $fixture_apply_invalid$
begin execute $fixture_invalid_migration$${migration.replace("16031ef57a236c0f712517d744d37c2b9174d350faf02871dbd6a75eb1207aa6", "0".repeat(64))}$fixture_invalid_migration$; end;
$fixture_apply_invalid$;
${fixture.replace("-- __ADMIN_EDITOR_OPERATIONS_MIGRATION__", () => migration)
    .replace("-- __ADMIN_EDITOR_OPERATIONS_REAPPLY__", () => migration)}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv.find((argument) => argument.startsWith("--write-sql="))?.slice("--write-sql=".length);
  if (!output) throw new Error("Use --write-sql=<local fixture SQL path>");
  writeFileSync(path.resolve(output), adminEditorOperationsContractSql(), "utf8");
  process.stdout.write("ADMIN_EDITOR_OPERATIONS_FIXTURE_WRITTEN\n");
}
