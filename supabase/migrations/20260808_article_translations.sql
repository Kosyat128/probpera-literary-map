-- Additive bilingual article storage. Existing public.articles columns remain the
-- Russian compatibility source until the admin application is migrated.

do $$
begin
  create type public.article_translation_status as enum (
    'draft',
    'review',
    'approved',
    'published',
    'stale',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.articles
  add column if not exists source_locale text not null default 'ru'
  check (source_locale in ('ru', 'en'));

create table if not exists public.article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  locale text not null check (locale in ('ru', 'en')),
  title text not null check (char_length(title) between 3 and 240),
  subtitle text not null default '' check (char_length(subtitle) <= 360),
  excerpt text not null default '' check (char_length(excerpt) <= 700),
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  cover_alt text not null default '' check (char_length(cover_alt) <= 500),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,179}$'),
  sources jsonb not null default '[]'::jsonb,
  bibliography jsonb not null default '[]'::jsonb,
  seo_title text check (char_length(seo_title) <= 180),
  seo_description text check (char_length(seo_description) <= 400),
  seo_keywords text[] not null default '{}',
  canonical_url text,
  og_title text check (char_length(og_title) <= 180),
  og_description text check (char_length(og_description) <= 400),
  status public.article_translation_status not null default 'draft',
  source_content_hash text,
  source_article_updated_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (article_id, locale),
  unique (locale, slug),
  check (
    status not in ('approved', 'published')
    or approved_at is not null
  ),
  check (
    status <> 'published'
    or published_at is not null
  )
);

create table if not exists public.article_translation_revisions (
  id bigint generated always as identity primary key,
  article_translation_id uuid not null
    references public.article_translations(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (article_translation_id, revision_number)
);

create index if not exists article_translations_article_locale_idx
  on public.article_translations(article_id, locale);
create index if not exists article_translations_release_idx
  on public.article_translations(locale, status, published_at desc)
  where deleted_at is null;
create index if not exists article_translation_revisions_translation_idx
  on public.article_translation_revisions(
    article_translation_id,
    revision_number desc
  );

create or replace function public.article_source_content_hash(
  article_row public.articles
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.md5(
    coalesce(article_row.title, '') || pg_catalog.chr(31) ||
    coalesce(article_row.subtitle, '') || pg_catalog.chr(31) ||
    coalesce(article_row.excerpt, '') || pg_catalog.chr(31) ||
    coalesce(article_row.content_json::text, '') || pg_catalog.chr(31) ||
    coalesce(article_row.content_html, '') || pg_catalog.chr(31) ||
    coalesce(article_row.cover_alt, '') || pg_catalog.chr(31) ||
    coalesce(article_row.slug, '') || pg_catalog.chr(31) ||
    coalesce(article_row.sources::text, '') || pg_catalog.chr(31) ||
    coalesce(article_row.bibliography::text, '') || pg_catalog.chr(31) ||
    coalesce(article_row.seo_title, '') || pg_catalog.chr(31) ||
    coalesce(article_row.seo_description, '') || pg_catalog.chr(31) ||
    coalesce(article_row.seo_keywords::text, '') || pg_catalog.chr(31) ||
    coalesce(article_row.og_title, '') || pg_catalog.chr(31) ||
    coalesce(article_row.og_description, '')
  );
$$;

create or replace function public.capture_article_translation_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if old is not distinct from new then
    return new;
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.article_translation_revisions
  where article_translation_id = old.id;

  insert into public.article_translation_revisions (
    article_translation_id,
    revision_number,
    snapshot,
    changed_by
  )
  values (
    old.id,
    next_revision,
    to_jsonb(old),
    coalesce(new.updated_by, (select auth.uid()))
  );

  return new;
end;
$$;

drop trigger if exists article_translations_capture_revision
  on public.article_translations;
create trigger article_translations_capture_revision
  before update on public.article_translations
  for each row execute function public.capture_article_translation_revision();

drop trigger if exists article_translations_set_updated_at
  on public.article_translations;
create trigger article_translations_set_updated_at
  before update on public.article_translations
  for each row execute function public.set_updated_at();

-- Preserve the current editor: every existing article is copied to an explicit
-- Russian translation without changing or deleting its compatibility columns.
insert into public.article_translations (
  article_id,
  locale,
  title,
  subtitle,
  excerpt,
  content_json,
  content_html,
  cover_alt,
  slug,
  sources,
  bibliography,
  seo_title,
  seo_description,
  seo_keywords,
  canonical_url,
  og_title,
  og_description,
  status,
  source_content_hash,
  source_article_updated_at,
  reviewed_by,
  reviewed_at,
  approved_by,
  approved_at,
  published_at,
  created_by,
  updated_by,
  created_at,
  updated_at,
  deleted_at
)
select
  article.id,
  'ru',
  article.title,
  article.subtitle,
  article.excerpt,
  article.content_json,
  article.content_html,
  article.cover_alt,
  article.slug,
  article.sources,
  article.bibliography,
  article.seo_title,
  article.seo_description,
  article.seo_keywords,
  article.canonical_url,
  article.og_title,
  article.og_description,
  case
    when article.status = 'published' then 'published'
    when article.status in ('review', 'scheduled') then 'review'
    when article.status in ('hidden', 'archived') then 'archived'
    else 'draft'
  end::public.article_translation_status,
  public.article_source_content_hash(article),
  article.updated_at,
  case when article.status = 'published' then article.updated_by else null end,
  case when article.status = 'published' then article.published_at else null end,
  case when article.status = 'published' then article.updated_by else null end,
  case when article.status = 'published' then article.published_at else null end,
  case when article.status = 'published' then article.published_at else null end,
  article.created_by,
  article.updated_by,
  article.created_at,
  article.updated_at,
  article.deleted_at
from public.articles article
on conflict (article_id, locale) do nothing;

create or replace function public.sync_russian_article_translation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.article_translation_status;
  next_hash text;
begin
  next_status := case
    when new.status = 'published' then 'published'
    when new.status in ('review', 'scheduled') then 'review'
    when new.status in ('hidden', 'archived') then 'archived'
    else 'draft'
  end;
  next_hash := public.article_source_content_hash(new);

  insert into public.article_translations (
    article_id,
    locale,
    title,
    subtitle,
    excerpt,
    content_json,
    content_html,
    cover_alt,
    slug,
    sources,
    bibliography,
    seo_title,
    seo_description,
    seo_keywords,
    canonical_url,
    og_title,
    og_description,
    status,
    source_content_hash,
    source_article_updated_at,
    reviewed_by,
    reviewed_at,
    approved_by,
    approved_at,
    published_at,
    created_by,
    updated_by,
    created_at,
    updated_at,
    deleted_at
  )
  values (
    new.id,
    'ru',
    new.title,
    new.subtitle,
    new.excerpt,
    new.content_json,
    new.content_html,
    new.cover_alt,
    new.slug,
    new.sources,
    new.bibliography,
    new.seo_title,
    new.seo_description,
    new.seo_keywords,
    new.canonical_url,
    new.og_title,
    new.og_description,
    next_status,
    next_hash,
    new.updated_at,
    case when next_status = 'published' then new.updated_by else null end,
    case when next_status = 'published' then new.published_at else null end,
    case when next_status = 'published' then new.updated_by else null end,
    case when next_status = 'published' then new.published_at else null end,
    case when next_status = 'published' then new.published_at else null end,
    new.created_by,
    new.updated_by,
    new.created_at,
    new.updated_at,
    new.deleted_at
  )
  on conflict (article_id, locale) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    excerpt = excluded.excerpt,
    content_json = excluded.content_json,
    content_html = excluded.content_html,
    cover_alt = excluded.cover_alt,
    slug = excluded.slug,
    sources = excluded.sources,
    bibliography = excluded.bibliography,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    seo_keywords = excluded.seo_keywords,
    canonical_url = excluded.canonical_url,
    og_title = excluded.og_title,
    og_description = excluded.og_description,
    status = excluded.status,
    source_content_hash = excluded.source_content_hash,
    source_article_updated_at = excluded.source_article_updated_at,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    published_at = excluded.published_at,
    updated_by = excluded.updated_by,
    deleted_at = excluded.deleted_at;

  if tg_op = 'UPDATE'
    and public.article_source_content_hash(old) is distinct from next_hash
  then
    update public.article_translations
    set
      status = 'stale',
      approved_by = null,
      approved_at = null,
      published_at = null,
      updated_by = new.updated_by,
      source_article_updated_at = new.updated_at
    where article_id = new.id
      and locale <> 'ru'
      and status in ('approved', 'published');
  end if;

  return new;
end;
$$;

drop trigger if exists articles_sync_russian_translation on public.articles;
create trigger articles_sync_russian_translation
  after insert or update of
    title,
    subtitle,
    excerpt,
    content_json,
    content_html,
    cover_alt,
    slug,
    sources,
    bibliography,
    seo_title,
    seo_description,
    seo_keywords,
    canonical_url,
    og_title,
    og_description,
    status,
    published_at,
    updated_by,
    deleted_at
  on public.articles
  for each row execute function public.sync_russian_article_translation();

alter table public.article_translations enable row level security;
alter table public.article_translation_revisions enable row level security;

create policy "Public read released article translations"
on public.article_translations for select
to anon, authenticated
using (
  (
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
  )
  or public.is_staff()
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
  public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
);

create policy "Staff read article translation revisions"
on public.article_translation_revisions for select
to authenticated
using (public.is_staff());
