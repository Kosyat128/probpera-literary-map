\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key
);

create table auth.mfa_factors (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

create or replace function auth.jwt()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;

grant execute on function auth.jwt() to anon, authenticated;

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

create policy "Staff read articles"
on public.articles for select
to authenticated
using (public.is_staff());

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

create policy "Staff read article translations"
on public.article_translations for select
to authenticated
using (public.is_staff());

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

insert into auth.users (id)
values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

insert into public.staff_memberships (user_id, role)
values ('00000000-0000-4000-8000-000000000001', 'editor');

insert into public.articles (
  id,
  title,
  status,
  slug,
  published_at,
  created_by,
  updated_by
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'Staff draft before MFA',
    'draft',
    'staff-draft-before-mfa',
    null,
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'Published article',
    'published',
    'published-article',
    now(),
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  );

insert into public.article_translations (
  id,
  article_id,
  locale,
  title,
  slug,
  status,
  published_at,
  created_by,
  updated_by
)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    'en',
    'Staff draft translation',
    'staff-draft-translation',
    'draft',
    null,
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000102',
    'en',
    'Published translation',
    'published-translation',
    'published',
    now(),
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  );

-- __STAFF_MFA_RLS_MIGRATION__

-- Opt-in semantics: a staff member who has not enrolled MFA must not be
-- locked out merely because the migration exists.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  false
);

do $staff_without_factor$
declare
  affected integer;
begin
  if not public.staff_mfa_session_allowed() then
    raise exception 'Staff without a verified MFA factor was locked out';
  end if;

  if not exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Staff without MFA cannot read its draft';
  end if;

  update public.articles
  set title = 'Staff draft still editable before enrollment'
  where id = '00000000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Staff without MFA could not update its draft';
  end if;
end;
$staff_without_factor$;
reset role;

insert into auth.mfa_factors (id, user_id, status)
values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000001',
  'verified'
);

-- After enrollment, an aal1 staff session is blocked at the database boundary.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  false
);

do $staff_aal1_blocked$
begin
  if public.staff_mfa_session_allowed() then
    raise exception 'Verified staff aal1 session was accepted';
  end if;

  if exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Verified staff aal1 session can still read a draft';
  end if;

  if exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'Verified staff aal1 session can still read a published article';
  end if;

  if exists (
    select 1 from public.article_translations
    where id = '00000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'Verified staff aal1 session can still read a draft translation';
  end if;

  begin
    insert into public.articles (
      id,
      title,
      status,
      slug,
      created_by,
      updated_by
    ) values (
      '00000000-0000-4000-8000-000000000103',
      'Blocked aal1 draft',
      'draft',
      'blocked-aal1-draft',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001'
    );
    raise exception 'Verified staff aal1 session unexpectedly inserted a draft';
  exception
    when insufficient_privilege then null;
  end;
end;
$staff_aal1_blocked$;
reset role;

-- The same verified user regains staff access only after the second factor
-- upgrades the JWT to aal2.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  false
);

do $staff_aal2_allowed$
declare
  affected integer;
begin
  if not public.staff_mfa_session_allowed() then
    raise exception 'Verified staff aal2 session was rejected';
  end if;

  if not exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Verified staff aal2 session cannot read a draft';
  end if;

  if not exists (
    select 1 from public.article_translations
    where id = '00000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'Verified staff aal2 session cannot read a draft translation';
  end if;

  update public.articles
  set title = 'Edited only after aal2'
  where id = '00000000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Verified staff aal2 session could not update the article';
  end if;

  update public.article_translations
  set title = 'English edited only after aal2'
  where id = '00000000-0000-4000-8000-000000000201';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Verified staff aal2 session could not update the translation';
  end if;
end;
$staff_aal2_allowed$;
reset role;

-- A reader is not turned into a staff user by enrolling MFA, and the staff-only
-- restrictive policy must not hide otherwise public content from that reader.
insert into auth.mfa_factors (id, user_id, status)
values (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000002',
  'verified'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  false
);

do $reader_with_factor$
begin
  if not public.staff_mfa_session_allowed() then
    raise exception 'Non-staff reader was incorrectly forced to aal2';
  end if;

  if not exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'Non-staff reader lost access to published content';
  end if;

  if exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Non-staff reader gained access to staff draft content';
  end if;
end;
$reader_with_factor$;
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{}', false);

do $anon_after_mfa_policy$
begin
  if not exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'Anonymous reader lost access to published content';
  end if;

  if exists (
    select 1 from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Anonymous reader gained access to draft content';
  end if;
end;
$anon_after_mfa_policy$;
reset role;

select 'STAFF_MFA_RLS_OK';
