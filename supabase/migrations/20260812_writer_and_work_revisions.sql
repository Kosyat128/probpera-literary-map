-- Durable editor-owned overrides for writer profiles and revision history for
-- both writers and literary works. The static country files remain the safe
-- fallback; published CMS values are applied last during the public build.

create table if not exists public.writer_profile_overrides (
  id uuid primary key default gen_random_uuid(),
  country_id text not null check (char_length(country_id) between 2 and 120),
  writer_id text not null check (char_length(writer_id) between 2 and 180),
  fields jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, writer_id),
  check (jsonb_typeof(fields) = 'object')
);

create index if not exists writer_profile_overrides_public_idx
  on public.writer_profile_overrides(country_id, writer_id)
  where is_enabled;

drop trigger if exists writer_profile_overrides_set_updated_at
  on public.writer_profile_overrides;
create trigger writer_profile_overrides_set_updated_at
  before update on public.writer_profile_overrides
  for each row execute function public.set_updated_at();

create table if not exists public.writer_profile_override_revisions (
  id bigint generated always as identity primary key,
  override_id uuid references public.writer_profile_overrides(id) on delete set null,
  country_id text not null,
  writer_id text not null,
  snapshot jsonb not null,
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create or replace function public.capture_writer_profile_override_revision()
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
  insert into public.writer_profile_override_revisions (
    override_id,
    country_id,
    writer_id,
    snapshot,
    revised_by
  ) values (
    old.id,
    old.country_id,
    old.writer_id,
    to_jsonb(old),
    revision_actor
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists writer_profile_overrides_capture_revision
  on public.writer_profile_overrides;
create trigger writer_profile_overrides_capture_revision
  before update or delete on public.writer_profile_overrides
  for each row execute function public.capture_writer_profile_override_revision();

alter table public.literary_works
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.literary_works
  add column if not exists is_cms_locked boolean not null default false;

create table if not exists public.literary_work_revisions (
  id bigint generated always as identity primary key,
  work_id uuid references public.literary_works(id) on delete set null,
  legacy_id text not null,
  snapshot jsonb not null,
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create or replace function public.capture_literary_work_revision()
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
  insert into public.literary_work_revisions (
    work_id,
    legacy_id,
    snapshot,
    revised_by
  ) values (
    old.id,
    old.legacy_id,
    to_jsonb(old),
    revision_actor
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists literary_works_capture_revision on public.literary_works;
create trigger literary_works_capture_revision
  before update or delete on public.literary_works
  for each row execute function public.capture_literary_work_revision();

create table if not exists public.site_chrome_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('banner', 'navigation_item')),
  entity_id uuid not null,
  snapshot jsonb not null,
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create index if not exists site_chrome_revisions_entity_idx
  on public.site_chrome_revisions(entity_type, entity_id, revised_at desc);

create or replace function public.capture_site_chrome_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;
  insert into public.site_chrome_revisions (
    entity_type,
    entity_id,
    snapshot,
    revised_by
  ) values (
    case when tg_table_name = 'banners' then 'banner' else 'navigation_item' end,
    old.id,
    to_jsonb(old),
    (select auth.uid())
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists banners_capture_visual_revision on public.banners;
create trigger banners_capture_visual_revision
  before update or delete on public.banners
  for each row execute function public.capture_site_chrome_revision();

drop trigger if exists navigation_items_capture_visual_revision
  on public.navigation_items;
create trigger navigation_items_capture_visual_revision
  before update or delete on public.navigation_items
  for each row execute function public.capture_site_chrome_revision();

alter table public.writer_profile_overrides enable row level security;
alter table public.writer_profile_override_revisions enable row level security;
alter table public.literary_work_revisions enable row level security;
alter table public.site_chrome_revisions enable row level security;

drop policy if exists "Public read enabled writer overrides"
  on public.writer_profile_overrides;
create policy "Public read enabled writer overrides"
on public.writer_profile_overrides for select
to anon, authenticated
using (is_enabled);

drop policy if exists "Staff manage writer overrides"
  on public.writer_profile_overrides;
create policy "Staff manage writer overrides"
on public.writer_profile_overrides for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Staff read writer override revisions"
  on public.writer_profile_override_revisions;
create policy "Staff read writer override revisions"
on public.writer_profile_override_revisions for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read literary work revisions"
  on public.literary_work_revisions;
create policy "Staff read literary work revisions"
on public.literary_work_revisions for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site chrome revisions"
  on public.site_chrome_revisions;
create policy "Staff read site chrome revisions"
on public.site_chrome_revisions for select
to authenticated
using (public.is_staff());
