import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const hotfix = readFileSync(
  path.join(
    root,
    "supabase/hotfixes/20260821_articles_staff_read_rls.sql"
  ),
  "utf8"
);
const postgresImage =
  process.env.POSTGRES_RLS_TEST_IMAGE || "postgres:17-alpine";
const dockerProbe = spawnSync(
  "docker",
  ["info", "--format", "{{.ServerVersion}}"],
  { encoding: "utf8" }
);
const dockerAvailable = dockerProbe.status === 0;
const integrationTest = dockerAvailable || process.env.CI ? it : it.skip;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
}

function commandFailure(label, result) {
  return [
    `${label} failed with status ${String(result.status)}`,
    result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : "",
    result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function waitForPostgres(containerName) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = docker([
      "exec",
      containerName,
      "pg_isready",
      "--username=postgres",
      "--dbname=probpera_rls",
    ]);
    if (result.status === 0) return;
    sleep(250);
  }
  throw new Error("PostgreSQL did not become ready for the RLS integration test");
}

const staffUser = "00000000-0000-4000-8000-000000000001";
const readerUser = "00000000-0000-4000-8000-000000000002";
const draftArticle = "00000000-0000-4000-8000-000000000101";
const publishedArticle = "00000000-0000-4000-8000-000000000102";
const draftTranslation = "00000000-0000-4000-8000-000000000201";

function integrationSql() {
  return String.raw`\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated;

create type public.staff_role as enum ('owner', 'admin', 'editor');
create type public.article_status as enum (
  'draft',
  'review',
  'scheduled',
  'published',
  'hidden',
  'archived'
);
create type public.article_translation_status as enum (
  'draft',
  'review',
  'approved',
  'published',
  'stale',
  'archived'
);

create table auth.users (
  id uuid primary key
);

create table public.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null
);

create or replace function public.is_staff(
  allowed_roles public.staff_role[] default array[
    'owner'::public.staff_role,
    'admin'::public.staff_role,
    'editor'::public.staff_role
  ]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships
    where user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;
revoke all on function public.is_staff(public.staff_role[]) from public;
grant execute on function public.is_staff(public.staff_role[]) to authenticated;

create table public.articles (
  id uuid primary key,
  title text not null,
  status public.article_status not null default 'draft',
  slug text not null unique,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  deleted_at timestamptz
);

create table public.article_translations (
  id uuid primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  locale text not null,
  title text not null,
  slug text not null,
  status public.article_translation_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  unique (article_id, locale),
  unique (locale, slug)
);

alter table public.articles enable row level security;
alter table public.article_translations enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.articles, public.article_translations to anon, authenticated;
grant insert, update, delete on public.articles, public.article_translations
  to authenticated;

create policy "Public read published articles"
on public.articles for select
to anon, authenticated
using (
  status = 'published'
  and published_at <= now()
  and deleted_at is null
);

create policy "Staff create articles"
on public.articles for insert
to authenticated
with check (
  public.is_staff()
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "Staff update articles"
on public.articles for update
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and updated_by = (select auth.uid())
);

create policy "Owners and admins delete articles"
on public.articles for delete
to authenticated
using (
  public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ])
);

create policy "Public read released article translations"
on public.article_translations for select
to anon, authenticated
using (
  status in ('approved', 'published')
  and deleted_at is null
  and exists (
    select 1
    from public.articles article
    where article.id = article_id
      and article.status = 'published'
      and article.published_at <= now()
      and article.deleted_at is null
  )
);

create policy "Staff create article translations"
on public.article_translations for insert
to authenticated
with check (
  public.is_staff()
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "Staff update article translations"
on public.article_translations for update
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and updated_by = (select auth.uid())
);

create policy "Owners and admins delete article translations"
on public.article_translations for delete
to authenticated
using (
  public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ])
);

${hotfix}

insert into auth.users (id)
values
  ('${staffUser}'),
  ('${readerUser}');
insert into public.staff_memberships (user_id, role)
values ('${staffUser}', 'editor');

insert into public.articles (
  id,
  title,
  status,
  slug,
  published_at,
  created_by,
  updated_by
)
values (
  '${publishedArticle}',
  'Published fixture',
  'published',
  'published-fixture',
  now(),
  '${staffUser}',
  '${staffUser}'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '${staffUser}', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"${staffUser}","role":"authenticated"}',
  false
);

do $staff_contract$
declare
  returned_id uuid;
begin
  insert into public.articles (
    id,
    title,
    status,
    slug,
    created_by,
    updated_by
  )
  values (
    '${draftArticle}',
    'Staff draft fixture',
    'draft',
    'staff-draft-fixture',
    '${staffUser}',
    '${staffUser}'
  )
  returning id into returned_id;

  if returned_id <> '${draftArticle}'::uuid then
    raise exception 'Staff INSERT ... RETURNING did not return the draft article';
  end if;

  if not exists (
    select 1 from public.articles where id = '${draftArticle}'
  ) then
    raise exception 'Staff cannot read the draft article after creation';
  end if;

  insert into public.article_translations (
    id,
    article_id,
    locale,
    title,
    slug,
    status,
    created_by,
    updated_by
  )
  values (
    '${draftTranslation}',
    '${draftArticle}',
    'en',
    'Staff translation fixture',
    'staff-translation-fixture',
    'draft',
    '${staffUser}',
    '${staffUser}'
  )
  returning id into returned_id;

  if returned_id <> '${draftTranslation}'::uuid then
    raise exception 'Staff translation INSERT ... RETURNING did not return its id';
  end if;

  if not exists (
    select 1
    from public.article_translations
    where id = '${draftTranslation}'
  ) then
    raise exception 'Staff cannot read the draft translation after creation';
  end if;
end;
$staff_contract$;
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);

do $anon_contract$
begin
  if exists (
    select 1 from public.articles where id = '${draftArticle}'
  ) then
    raise exception 'Anonymous readers can see a draft article';
  end if;

  if exists (
    select 1
    from public.article_translations
    where id = '${draftTranslation}'
  ) then
    raise exception 'Anonymous readers can see a draft translation';
  end if;

  if not exists (
    select 1 from public.articles where id = '${publishedArticle}'
  ) then
    raise exception 'Anonymous readers cannot see a published article';
  end if;
end;
$anon_contract$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '${readerUser}', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"${readerUser}","role":"authenticated"}',
  false
);

do $reader_contract$
begin
  if exists (
    select 1 from public.articles where id = '${draftArticle}'
  ) then
    raise exception 'A non-staff authenticated reader can see a draft article';
  end if;

  begin
    insert into public.articles (
      id,
      title,
      status,
      slug,
      created_by,
      updated_by
    )
    values (
      '00000000-0000-4000-8000-000000000103',
      'Forbidden reader draft',
      'draft',
      'forbidden-reader-draft',
      '${readerUser}',
      '${readerUser}'
    );
    raise exception 'A non-staff reader unexpectedly created an article';
  exception
    when insufficient_privilege then null;
  end;
end;
$reader_contract$;
reset role;

select 'RLS_CONTRACT_OK';
`;
}

describe("article RLS integration contract", () => {
  integrationTest(
    "executes staff INSERT ... RETURNING and keeps drafts private",
    () => {
      if (!dockerAvailable) {
        throw new Error(
          `Docker is required for the CI RLS integration test: ${
            dockerProbe.stderr?.trim() || "Docker daemon is unavailable"
          }`
        );
      }

      const containerName = `probpera-rls-${process.pid}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)}`;
      let started = false;
      try {
        const start = docker(
          [
            "run",
            "--detach",
            "--rm",
            "--name",
            containerName,
            "--network",
            "none",
            "--env",
            "POSTGRES_PASSWORD=probpera-test-only",
            "--env",
            "POSTGRES_DB=probpera_rls",
            postgresImage,
          ],
          { timeout: 120_000 }
        );
        if (start.status !== 0) {
          throw new Error(commandFailure("Starting PostgreSQL", start));
        }
        started = true;
        waitForPostgres(containerName);

        const result = docker(
          [
            "exec",
            "--interactive",
            containerName,
            "psql",
            "--username=postgres",
            "--dbname=probpera_rls",
            "--no-psqlrc",
            "--set=ON_ERROR_STOP=1",
          ],
          {
            input: integrationSql(),
            timeout: 90_000,
          }
        );
        if (result.status !== 0) {
          throw new Error(commandFailure("Executing the RLS contract", result));
        }
        expect(result.stdout).toContain("RLS_CONTRACT_OK");
      } finally {
        if (started) {
          docker(["rm", "--force", containerName], { timeout: 20_000 });
        }
      }
    },
    240_000
  );
});
