\set ON_ERROR_STOP on
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

-- __ARTICLE_RLS_HOTFIX__

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
values (
  '00000000-0000-4000-8000-000000000102',
  'Published fixture',
  'published',
  'published-fixture',
  now(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
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
    '00000000-0000-4000-8000-000000000101',
    'Staff draft fixture',
    'draft',
    'staff-draft-fixture',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  )
  returning id into returned_id;

  if returned_id <> '00000000-0000-4000-8000-000000000101'::uuid then
    raise exception 'Staff INSERT ... RETURNING did not return the draft article';
  end if;

  if not exists (
    select 1
    from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
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
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    'en',
    'Staff translation fixture',
    'staff-translation-fixture',
    'draft',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  )
  returning id into returned_id;

  if returned_id <> '00000000-0000-4000-8000-000000000201'::uuid then
    raise exception 'Staff translation INSERT ... RETURNING did not return its id';
  end if;

  if not exists (
    select 1
    from public.article_translations
    where id = '00000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'Staff cannot read the draft translation after creation';
  end if;
end;
$staff_contract$;
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $anon_contract$
begin
  if exists (
    select 1
    from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Anonymous readers can see a draft article';
  end if;

  if exists (
    select 1
    from public.article_translations
    where id = '00000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'Anonymous readers can see a draft translation';
  end if;

  if not exists (
    select 1
    from public.articles
    where id = '00000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'Anonymous readers cannot see a published article';
  end if;
end;
$anon_contract$;
reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  false
);

do $reader_contract$
begin
  if exists (
    select 1
    from public.articles
    where id = '00000000-0000-4000-8000-000000000101'
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
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000002'
    );
    raise exception 'A non-staff reader unexpectedly created an article';
  exception
    when insufficient_privilege then null;
  end;
end;
$reader_contract$;
reset role;

select 'RLS_CONTRACT_OK';
