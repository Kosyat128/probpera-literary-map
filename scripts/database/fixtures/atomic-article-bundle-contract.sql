\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;

create table auth.users (id uuid primary key);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to authenticated;

create type public.staff_role as enum ('owner', 'admin', 'editor');
create type public.article_status as enum (
  'draft', 'review', 'scheduled', 'published', 'hidden', 'archived'
);
create type public.article_translation_status as enum (
  'draft', 'review', 'approved', 'published', 'stale', 'archived'
);

create table public.staff_memberships (
  user_id uuid primary key references auth.users(id),
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
    select 1 from public.staff_memberships
    where user_id = (select auth.uid()) and role = any(allowed_roles)
  );
$$;
revoke all on function public.is_staff(public.staff_role[]) from public;
grant execute on function public.is_staff(public.staff_role[]) to authenticated;

create table public.categories (
  id uuid primary key,
  slug text not null unique
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null check (char_length(title) between 3 and 240),
  subtitle text not null default '',
  excerpt text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  cover_external_url text,
  cover_alt text not null default '',
  category_id uuid references public.categories(id),
  status public.article_status not null default 'draft',
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,179}$'),
  legacy_path text unique,
  published_at timestamptz,
  scheduled_at timestamptz,
  featured boolean not null default false,
  show_on_homepage boolean not null default false,
  pinned boolean not null default false,
  sources jsonb not null default '[]'::jsonb,
  bibliography jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',
  canonical_url text,
  og_title text,
  og_description text,
  allow_indexing boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status <> 'scheduled' or scheduled_at is not null),
  check (status <> 'published' or published_at is not null)
);

create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now(),
  unique(article_id, revision_number)
);

create table public.article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  locale text not null,
  title text not null check (char_length(title) between 3 and 240),
  subtitle text not null default '',
  excerpt text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  cover_alt text not null default '',
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,179}$'),
  sources jsonb not null default '[]'::jsonb,
  bibliography jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',
  canonical_url text,
  og_title text,
  og_description text,
  status public.article_translation_status not null default 'draft',
  source_content_hash text,
  source_article_updated_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(article_id, locale),
  unique(locale, slug),
  check (status not in ('approved', 'published') or approved_at is not null),
  check (status <> 'published' or published_at is not null)
);

create table public.article_translation_revisions (
  id bigint generated always as identity primary key,
  article_translation_id uuid not null references public.article_translations(id),
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now(),
  unique(article_translation_id, revision_number)
);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_path text not null,
  status_code smallint not null default 301,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.public_build_outbox (
  id bigint generated always as identity primary key,
  actor_id uuid,
  entity_type text not null,
  entity_id text not null,
  reason text not null,
  status text not null default 'requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
create trigger articles_set_updated_at before update on public.articles
for each row execute function public.set_updated_at();
create trigger article_translations_set_updated_at before update on public.article_translations
for each row execute function public.set_updated_at();
create trigger redirects_set_updated_at before update on public.redirects
for each row execute function public.set_updated_at();

create or replace function public.capture_article_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if old is not distinct from new then return new; end if;
  select coalesce(max(revision_number), 0) + 1 into n
  from public.article_revisions where article_id = old.id;
  insert into public.article_revisions(article_id, revision_number, snapshot, changed_by)
  values(old.id, n, to_jsonb(old), coalesce(new.updated_by, (select auth.uid())));
  return new;
end;
$$;
create trigger articles_capture_revision before update on public.articles
for each row execute function public.capture_article_revision();

create or replace function public.capture_article_translation_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if old is not distinct from new then return new; end if;
  select coalesce(max(revision_number), 0) + 1 into n
  from public.article_translation_revisions
  where article_translation_id = old.id;
  insert into public.article_translation_revisions(
    article_translation_id, revision_number, snapshot, changed_by
  ) values(old.id, n, to_jsonb(old), coalesce(new.updated_by, (select auth.uid())));
  return new;
end;
$$;
create trigger article_translations_capture_revision
before update on public.article_translations
for each row execute function public.capture_article_translation_revision();

-- Mimic the important production behavior: changing the Russian source can
-- stale a released English translation before the explicit English save runs.
create or replace function public.fixture_sync_english_after_article()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.title is distinct from new.title then
    update public.article_translations
    set status = 'stale', approved_by = null, approved_at = null,
        published_at = null, updated_by = new.updated_by
    where article_id = new.id and locale = 'en'
      and status in ('approved', 'published');
  end if;
  return new;
end;
$$;
create trigger articles_fixture_sync_english
after update on public.articles
for each row execute function public.fixture_sync_english_after_article();

create or replace function public.fixture_capture_outbox()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.public_build_outbox(actor_id, entity_type, entity_id, reason, metadata)
  values((select auth.uid()), tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'article_id', tg_table_name),
    'database-' || lower(tg_op),
    jsonb_build_object('operation', lower(tg_op), 'table', tg_table_name));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger articles_public_build_outbox after insert or update or delete on public.articles
for each row execute function public.fixture_capture_outbox();
create trigger article_translations_public_build_outbox after insert or update or delete on public.article_translations
for each row execute function public.fixture_capture_outbox();
create trigger redirects_public_build_outbox after insert or update or delete on public.redirects
for each row execute function public.fixture_capture_outbox();

alter table public.articles enable row level security;
alter table public.article_translations enable row level security;
alter table public.redirects enable row level security;
alter table public.admin_audit_log enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.articles to authenticated;
grant select, insert, update, delete on public.article_translations to authenticated;
grant select, insert, update on public.redirects to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "Staff read articles" on public.articles for select to authenticated
using (public.is_staff());
create policy "Staff create articles" on public.articles for insert to authenticated
with check (public.is_staff() and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy "Staff update articles" on public.articles for update to authenticated
using (public.is_staff()) with check (public.is_staff() and updated_by = (select auth.uid()));
create policy "Staff read article translations" on public.article_translations for select to authenticated
using (public.is_staff());
create policy "Staff create article translations" on public.article_translations for insert to authenticated
with check (public.is_staff() and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy "Staff update article translations" on public.article_translations for update to authenticated
using (public.is_staff()) with check (public.is_staff() and updated_by = (select auth.uid()));
create policy "Staff manage redirects" on public.redirects for all to authenticated
using (public.is_staff()) with check (public.is_staff() and created_by = (select auth.uid()));
create policy "Staff append audit log" on public.admin_audit_log for insert to authenticated
with check (public.is_staff() and actor_id = (select auth.uid()));

-- The migration's schema-health function expects these names to exist or be
-- safely probeable. Only public_build_outbox is referenced as a real relation.
create or replace function public.enqueue_public_build_request(text,text,text,jsonb)
returns bigint language sql as $$ select 1::bigint $$;
create or replace function public.move_homepage_block(uuid,text)
returns boolean language sql as $$ select true $$;

-- __ATOMIC_ARTICLE_BUNDLE_MIGRATION__

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.staff_memberships(user_id, role)
values ('00000000-0000-4000-8000-000000000001', 'editor');
insert into public.categories(id, slug)
values ('00000000-0000-4000-8000-000000000010', 'tests');

insert into public.articles(
  id,title,subtitle,excerpt,slug,content_html,content_json,category_id,status,
  published_at,cover_alt,seo_title,seo_description,canonical_url,og_title,
  og_description,allow_indexing,sources,bibliography,show_on_homepage,
  created_by,updated_by
) values (
  '00000000-0000-4000-8000-000000000101','Original Russian','','Excerpt',
  'original-russian','<p>Original</p>','{"type":"doc","content":[]}',
  '00000000-0000-4000-8000-000000000010','published',now(),'Alt',
  'Original Russian','Original description','https://example.test/original-russian',
  'Original Russian','Original description',true,'[]','[]',true,
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'
);
insert into public.article_translations(
  id,article_id,locale,title,excerpt,slug,status,source_content_hash,
  source_article_updated_at,reviewed_by,reviewed_at,approved_by,approved_at,
  published_at,created_by,updated_by
) values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101','en','Original English','Excerpt',
  'original-english','published','old-hash',now(),
  '00000000-0000-4000-8000-000000000001',now(),
  '00000000-0000-4000-8000-000000000001',now(),now(),
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'
);
truncate public.public_build_outbox restart identity;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

do $success_contract$
declare
  a_updated timestamptz;
  e_updated timestamptz;
  article_expected timestamptz;
  english_expected timestamptz;
begin
  select updated_at into article_expected from public.articles
  where id = '00000000-0000-4000-8000-000000000101';
  select updated_at into english_expected from public.article_translations
  where id = '00000000-0000-4000-8000-000000000201';

  select article_updated_at, english_updated_at
  into a_updated, e_updated
  from public.save_article_bundle(
    '00000000-0000-4000-8000-000000000101',
    article_expected,
    jsonb_build_object(
      'title','Updated Russian','subtitle','','excerpt','Updated excerpt',
      'slug','updated-russian','content_html','<p>Updated</p>',
      'content_json',jsonb_build_object('type','doc','content',jsonb_build_array()),
      'category_id','00000000-0000-4000-8000-000000000010',
      'status','published','published_at',now()::text,'cover_alt','Alt text',
      'seo_title','Updated Russian','seo_description','Updated description',
      'seo_keywords',jsonb_build_array('books'),'canonical_url','https://example.test/updated-russian',
      'og_title','Updated Russian','og_description','Updated description',
      'allow_indexing',true,'sources',jsonb_build_array(),'bibliography',jsonb_build_array(),
      'featured',false,'show_on_homepage',true,'pinned',false
    ),
    'save',
    jsonb_build_object(
      'title','Updated English','subtitle','','excerpt','Updated excerpt',
      'slug','updated-english','content_html','<p>Updated</p>',
      'content_json',jsonb_build_object('type','doc','content',jsonb_build_array()),
      'cover_alt','Alt text','sources',jsonb_build_array(),'bibliography',jsonb_build_array(),
      'seo_title','Updated English','seo_description','Updated description',
      'seo_keywords',jsonb_build_array('books'),'canonical_url','https://example.test/en/updated-english',
      'og_title','Updated English','og_description','Updated description',
      'status','published','source_content_hash','new-hash','reviewed_at',now()::text,
      'approved_at',now()::text,'published_at',now()::text
    ),
    english_expected,
    '/old-russian','/new-russian',true,
    'article.updated',jsonb_build_object('test',true),false,'{}'::jsonb
  );

  if a_updated is null or e_updated is null then
    raise exception 'Atomic save did not return both updated timestamps';
  end if;
  if (select title from public.articles where id='00000000-0000-4000-8000-000000000101') <> 'Updated Russian' then
    raise exception 'Russian row was not updated';
  end if;
  if (select title from public.article_translations where id='00000000-0000-4000-8000-000000000201') <> 'Updated English' then
    raise exception 'English row was not updated after the source-stale trigger';
  end if;
  if (select status from public.article_translations where id='00000000-0000-4000-8000-000000000201') <> 'published' then
    raise exception 'English final state was not restored to published';
  end if;
  if not exists (select 1 from public.article_revisions where article_id='00000000-0000-4000-8000-000000000101') then
    raise exception 'Article revision trigger did not participate';
  end if;
  if not exists (select 1 from public.article_translation_revisions where article_translation_id='00000000-0000-4000-8000-000000000201') then
    raise exception 'Translation revision trigger did not participate';
  end if;
  if (select count(*) from public.public_build_outbox) < 2 then
    raise exception 'Transactional outbox triggers did not participate';
  end if;
end;
$success_contract$;

-- A constraint failure in the English mutation must roll back every Russian,
-- revision, audit, redirect and outbox mutation in that function call.
do $rollback_contract$
declare
  article_expected timestamptz;
  english_expected timestamptz;
  before_article text;
  before_english text;
  before_article_revisions bigint;
  before_english_revisions bigint;
  before_outbox bigint;
  before_audit bigint;
  before_redirects bigint;
begin
  select updated_at,title into article_expected,before_article from public.articles
  where id='00000000-0000-4000-8000-000000000101';
  select updated_at,title into english_expected,before_english from public.article_translations
  where id='00000000-0000-4000-8000-000000000201';
  select count(*) into before_article_revisions from public.article_revisions;
  select count(*) into before_english_revisions from public.article_translation_revisions;
  select count(*) into before_outbox from public.public_build_outbox;
  select count(*) into before_audit from public.admin_audit_log;
  select count(*) into before_redirects from public.redirects;

  begin
    perform * from public.save_article_bundle(
      '00000000-0000-4000-8000-000000000101',article_expected,
      jsonb_build_object(
        'title','Must Roll Back','excerpt','x','slug','must-roll-back',
        'content_html','<p>x</p>','content_json',jsonb_build_object('type','doc','content',jsonb_build_array()),
        'category_id','00000000-0000-4000-8000-000000000010','status','draft',
        'cover_alt','','seo_keywords',jsonb_build_array(),'allow_indexing',false,
        'sources',jsonb_build_array(),'bibliography',jsonb_build_array(),
        'featured',false,'show_on_homepage',false,'pinned',false
      ),
      'save',
      jsonb_build_object(
        'title','x','slug','invalid-english','status','draft',
        'seo_keywords',jsonb_build_array(),'sources',jsonb_build_array(),
        'bibliography',jsonb_build_array(),'content_json',jsonb_build_object('type','doc','content',jsonb_build_array())
      ),
      english_expected,'/rollback-old','/rollback-new',false,
      'article.updated',jsonb_build_object('rollback',true),false,'{}'::jsonb
    );
    raise exception 'Invalid English payload unexpectedly committed';
  exception
    when check_violation then null;
  end;

  if (select title from public.articles where id='00000000-0000-4000-8000-000000000101') <> before_article then
    raise exception 'Russian row changed after English failure';
  end if;
  if (select title from public.article_translations where id='00000000-0000-4000-8000-000000000201') <> before_english then
    raise exception 'English row changed after failed save';
  end if;
  if (select count(*) from public.article_revisions) <> before_article_revisions
    or (select count(*) from public.article_translation_revisions) <> before_english_revisions
    or (select count(*) from public.public_build_outbox) <> before_outbox
    or (select count(*) from public.admin_audit_log) <> before_audit
    or (select count(*) from public.redirects) <> before_redirects then
    raise exception 'Side effects survived a rolled-back atomic save';
  end if;
end;
$rollback_contract$;

-- A stale optimistic token must fail before any write.
do $conflict_contract$
declare before_title text; before_outbox bigint;
begin
  select title into before_title from public.articles
  where id='00000000-0000-4000-8000-000000000101';
  select count(*) into before_outbox from public.public_build_outbox;
  begin
    perform * from public.save_article_bundle(
      '00000000-0000-4000-8000-000000000101',
      '2000-01-01T00:00:00Z'::timestamptz,
      jsonb_build_object('title','Conflict','slug','conflict','status','draft'),
      'none',null,null,null,null,false,null,'{}'::jsonb,false,'{}'::jsonb
    );
    raise exception 'Stale article token unexpectedly committed';
  exception
    when raise_exception then
      if sqlerrm <> 'ARTICLE_CONFLICT' then raise; end if;
  end;
  if (select title from public.articles where id='00000000-0000-4000-8000-000000000101') <> before_title
    or (select count(*) from public.public_build_outbox) <> before_outbox then
    raise exception 'Conflict path produced a write';
  end if;
end;
$conflict_contract$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $reader_contract$
begin
  begin
    perform * from public.save_article_bundle(
      null,null,jsonb_build_object('title','Reader write','slug','reader-write','status','draft'),
      'none',null,null,null,null,false,null,'{}'::jsonb,false,'{}'::jsonb
    );
    raise exception 'Non-staff user unexpectedly executed an article save';
  exception
    when insufficient_privilege then null;
  end;
end;
$reader_contract$;
reset role;

select 'ATOMIC_ARTICLE_BUNDLE_OK';
