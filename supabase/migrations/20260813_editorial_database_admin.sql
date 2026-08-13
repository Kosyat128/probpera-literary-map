-- Full editorial database overrides for countries plus missing history for
-- exact book editions. Static TypeScript records remain the audited fallback;
-- enabled CMS overrides are exported and applied last by the public build.

create table if not exists public.country_profile_overrides (
  id uuid primary key default gen_random_uuid(),
  country_id text not null unique
    check (char_length(country_id) between 2 and 120),
  fields jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(fields) = 'object')
);

create index if not exists country_profile_overrides_public_idx
  on public.country_profile_overrides(country_id)
  where is_enabled;

drop trigger if exists country_profile_overrides_set_updated_at
  on public.country_profile_overrides;
create trigger country_profile_overrides_set_updated_at
  before update on public.country_profile_overrides
  for each row execute function public.set_updated_at();

create table if not exists public.country_profile_override_revisions (
  id bigint generated always as identity primary key,
  override_id uuid references public.country_profile_overrides(id)
    on delete set null,
  country_id text not null,
  snapshot jsonb not null,
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create index if not exists country_profile_override_revisions_country_idx
  on public.country_profile_override_revisions(country_id, revised_at desc);

create or replace function public.capture_country_profile_override_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_actor uuid;
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    revision_actor := coalesce(new.updated_by, (select auth.uid()));
  else
    revision_actor := (select auth.uid());
  end if;
  insert into public.country_profile_override_revisions (
    override_id,
    country_id,
    snapshot,
    revised_by
  ) values (
    old.id,
    old.country_id,
    to_jsonb(old),
    revision_actor
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists country_profile_overrides_capture_revision
  on public.country_profile_overrides;
create trigger country_profile_overrides_capture_revision
  before update or delete on public.country_profile_overrides
  for each row execute function public.capture_country_profile_override_revision();

create table if not exists public.book_edition_revisions (
  id bigint generated always as identity primary key,
  edition_id uuid references public.book_editions(id) on delete set null,
  legacy_id text not null,
  snapshot jsonb not null,
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create index if not exists book_edition_revisions_edition_idx
  on public.book_edition_revisions(edition_id, revised_at desc);

create or replace function public.capture_book_edition_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;
  insert into public.book_edition_revisions (
    edition_id,
    legacy_id,
    snapshot,
    revised_by
  ) values (
    old.id,
    old.legacy_id,
    to_jsonb(old),
    (select auth.uid())
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists book_editions_capture_revision on public.book_editions;
create trigger book_editions_capture_revision
  before update or delete on public.book_editions
  for each row execute function public.capture_book_edition_revision();

alter table public.country_profile_overrides enable row level security;
alter table public.country_profile_override_revisions enable row level security;
alter table public.book_edition_revisions enable row level security;

drop policy if exists "Public read enabled country overrides"
  on public.country_profile_overrides;
create policy "Public read enabled country overrides"
on public.country_profile_overrides for select
to anon, authenticated
using (is_enabled);

drop policy if exists "Staff manage country overrides"
  on public.country_profile_overrides;
create policy "Staff manage country overrides"
on public.country_profile_overrides for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Staff read country override revisions"
  on public.country_profile_override_revisions;
create policy "Staff read country override revisions"
on public.country_profile_override_revisions for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read book edition revisions"
  on public.book_edition_revisions;
create policy "Staff read book edition revisions"
on public.book_edition_revisions for select
to authenticated
using (public.is_staff());

-- Public policies must never invoke the staff-only helper. It is deliberately
-- not executable by anon; authenticated staff receive the wider view through
-- the separate permissive staff policies already defined for every table.
drop policy if exists "Public read visible categories" on public.categories;
create policy "Public read visible categories"
on public.categories for select to anon, authenticated using (is_visible);

drop policy if exists "Public read active media metadata" on public.media_assets;
create policy "Public read active media metadata"
on public.media_assets for select to anon, authenticated using (deleted_at is null);

drop policy if exists "Public read published articles" on public.articles;
create policy "Public read published articles"
on public.articles for select to anon, authenticated
using (status = 'published' and published_at <= now() and deleted_at is null);

drop policy if exists "Public read published article tags" on public.article_tags;
create policy "Public read published article tags"
on public.article_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.articles
    where id = article_id
      and status = 'published'
      and published_at <= now()
      and deleted_at is null
  )
);

drop policy if exists "Public read published pages" on public.pages;
create policy "Public read published pages"
on public.pages for select to anon, authenticated
using (status = 'published' and deleted_at is null);

drop policy if exists "Public read enabled homepage blocks" on public.homepage_blocks;
create policy "Public read enabled homepage blocks"
on public.homepage_blocks for select to anon, authenticated using (is_enabled);

drop policy if exists "Public read active banners" on public.banners;
create policy "Public read active banners"
on public.banners for select to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Public read visible navigation items" on public.navigation_items;
create policy "Public read visible navigation items"
on public.navigation_items for select to anon, authenticated using (is_visible);

drop policy if exists "Public read active redirects" on public.redirects;
create policy "Public read active redirects"
on public.redirects for select to anon, authenticated using (is_active);

drop policy if exists "Public read released article translations"
  on public.article_translations;
create policy "Public read released article translations"
on public.article_translations for select to anon, authenticated
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

drop policy if exists "Public read publishable literary works" on public.literary_works;
create policy "Public read publishable literary works"
on public.literary_works for select to anon, authenticated
using (public.is_publishable_literary_work(id));

drop policy if exists "Public read publishable work translations"
  on public.literary_work_translations;
create policy "Public read publishable work translations"
on public.literary_work_translations for select to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read publishable work sources"
  on public.literary_work_sources;
create policy "Public read publishable work sources"
on public.literary_work_sources for select to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read publishable work external ids"
  on public.literary_work_external_ids;
create policy "Public read publishable work external ids"
on public.literary_work_external_ids for select to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read verified book editions" on public.book_editions;
create policy "Public read verified book editions"
on public.book_editions for select to anon, authenticated
using (
  (
    cover_url is null
    or (
      cover_rights_status <> 'unverified'
      and cover_source_url is not null
      and rights_checked_at is not null
    )
  )
  and exists (
    select 1
    from public.literary_works
    where literary_works.id = book_editions.work_id
      and literary_works.editorial_status in ('reviewed', 'verified')
  )
);
