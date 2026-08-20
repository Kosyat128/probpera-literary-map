-- Work-level editorial artwork is intentionally separate from book_editions.
-- User-supplied illustrations do not identify a publisher, printing or ISBN.

create table if not exists public.literary_work_cover_artworks (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.literary_works(id) on delete cascade,
  cover_url text not null check (
    cover_url ~ '^brand/book-covers/[a-z0-9][a-z0-9-]*\.webp$'
    or cover_url ~ '^https://'
  ),
  thumbnail_url text not null check (
    thumbnail_url ~ '^brand/book-covers/thumbs/[a-z0-9][a-z0-9-]*\.webp$'
    or thumbnail_url ~ '^https://'
  ),
  cover_width integer not null check (cover_width between 1 and 4000),
  cover_height integer not null check (cover_height between 1 and 6000),
  thumbnail_width integer not null check (thumbnail_width between 1 and 2000),
  thumbnail_height integer not null check (thumbnail_height between 1 and 3000),
  rights_status text not null default 'editorial-original'
    check (rights_status = 'editorial-original'),
  cover_source_url text not null check (cover_source_url ~ '^https://'),
  rights_checked_at date not null,
  source_archive_sha256 text not null check (source_archive_sha256 ~ '^[a-f0-9]{64}$'),
  source_image_sha256 text not null check (source_image_sha256 ~ '^[a-f0-9]{64}$'),
  source_filename text not null check (char_length(source_filename) between 1 and 500),
  source_relative_path text not null check (char_length(source_relative_path) between 1 and 900),
  source_index integer not null check (source_index > 0),
  is_primary boolean not null default true,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, source_archive_sha256, source_image_sha256),
  unique (source_archive_sha256, source_index),
  check (
    provenance @> '{"kind":"user-supplied"}'::jsonb
    and provenance->>'archiveSha256' = source_archive_sha256
    and provenance->>'imageSha256' = source_image_sha256
  )
);

create unique index if not exists literary_work_cover_artworks_one_primary_idx
  on public.literary_work_cover_artworks(work_id)
  where is_primary;

create index if not exists literary_work_cover_artworks_work_idx
  on public.literary_work_cover_artworks(work_id, rights_checked_at desc);

create or replace function public.guard_literary_work_cover_artwork_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.work_id is distinct from old.work_id
    or new.cover_url is distinct from old.cover_url
    or new.thumbnail_url is distinct from old.thumbnail_url
    or new.cover_width is distinct from old.cover_width
    or new.cover_height is distinct from old.cover_height
    or new.thumbnail_width is distinct from old.thumbnail_width
    or new.thumbnail_height is distinct from old.thumbnail_height
    or new.rights_status is distinct from old.rights_status
    or new.cover_source_url is distinct from old.cover_source_url
    or new.rights_checked_at is distinct from old.rights_checked_at
    or new.source_archive_sha256 is distinct from old.source_archive_sha256
    or new.source_image_sha256 is distinct from old.source_image_sha256
    or new.source_filename is distinct from old.source_filename
    or new.source_relative_path is distinct from old.source_relative_path
    or new.source_index is distinct from old.source_index
    or new.provenance is distinct from old.provenance then
    raise exception
      'Literary work artwork provenance is immutable; create a new artwork row instead.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_literary_work_cover_artwork_provenance()
  from public;

drop trigger if exists literary_work_cover_artworks_guard_provenance
  on public.literary_work_cover_artworks;
create trigger literary_work_cover_artworks_guard_provenance
  before update on public.literary_work_cover_artworks
  for each row execute function public.guard_literary_work_cover_artwork_provenance();

drop trigger if exists literary_work_cover_artworks_set_updated_at
  on public.literary_work_cover_artworks;
create trigger literary_work_cover_artworks_set_updated_at
  before update on public.literary_work_cover_artworks
  for each row execute function public.set_updated_at();

do $$
begin
  if to_regprocedure('public.capture_public_build_outbox()') is not null then
    execute 'drop trigger if exists literary_work_cover_artworks_public_build_outbox '
      || 'on public.literary_work_cover_artworks';
    execute 'create trigger literary_work_cover_artworks_public_build_outbox '
      || 'after insert or update or delete on public.literary_work_cover_artworks '
      || 'for each row execute function public.capture_public_build_outbox()';
  end if;
end;
$$;

alter table public.literary_work_cover_artworks enable row level security;

revoke all on table public.literary_work_cover_artworks from anon, authenticated;
grant select on table public.literary_work_cover_artworks to anon, authenticated;
grant insert, update, delete on table public.literary_work_cover_artworks
  to authenticated;
grant all on table public.literary_work_cover_artworks to service_role;

drop policy if exists "Public read publishable literary work artwork"
  on public.literary_work_cover_artworks;
create policy "Public read publishable literary work artwork"
on public.literary_work_cover_artworks for select
to anon, authenticated
using (
  rights_status = 'editorial-original'
  and rights_checked_at is not null
  and public.is_publishable_literary_work(work_id)
);

drop policy if exists "Staff manage literary work artwork"
  on public.literary_work_cover_artworks;
create policy "Staff manage literary work artwork"
on public.literary_work_cover_artworks for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Keep the staff-only schema-health contract current after adding the 21st
-- publication-bearing editorial relation.
create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then jsonb_build_object(
      'version', '20260820_literary_work_cover_artworks',
      'checkedAt', now(),
      'outbox', to_regclass('public.public_build_outbox') is not null,
      'outboxRpc',
        to_regprocedure(
          'public.enqueue_public_build_request(text,text,text,jsonb)'
        ) is not null,
      'migrationLedger',
        to_regclass('public.probpera_schema_migrations') is not null,
      'publicationTriggers', (
        select count(*) = 21
        from pg_catalog.pg_trigger outbox_trigger
        join pg_catalog.pg_class relation
          on relation.oid = outbox_trigger.tgrelid
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and not outbox_trigger.tgisinternal
          and outbox_trigger.tgfoid =
            'public.capture_public_build_outbox()'::regprocedure
          and outbox_trigger.tgname =
            (relation.relname::text || '_public_build_outbox')::name
          and relation.relname = any(array[
            'articles',
            'article_tags',
            'article_translations',
            'pages',
            'homepage_blocks',
            'banners',
            'navigation_menus',
            'navigation_items',
            'redirects',
            'categories',
            'tags',
            'media_assets',
            'media_usages',
            'literary_works',
            'literary_work_translations',
            'literary_work_sources',
            'literary_work_external_ids',
            'book_editions',
            'writer_profile_overrides',
            'country_profile_overrides',
            'literary_work_cover_artworks'
          ]::name[])
      ),
      'pendingPublicBuilds', (
        select count(*)
        from public.public_build_outbox
        where status in ('requested', 'dispatched', 'failed')
      ),
      'revisionHistory',
        to_regclass('public.admin_revision_history') is not null,
      'workTranslations',
        to_regclass('public.literary_work_translations') is not null,
      'workCoverArtworks',
        to_regclass('public.literary_work_cover_artworks') is not null,
      'countryOverrides',
        to_regclass('public.country_profile_overrides') is not null,
      'writerOverrides',
        to_regclass('public.writer_profile_overrides') is not null,
      'homepageMove',
        to_regprocedure('public.move_homepage_block(uuid,text)') is not null,
      'tagsUpdatedAt', exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'tags'
          and column_name = 'updated_at'
      )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health() from public;
grant execute on function public.get_editorial_schema_health()
  to authenticated;

comment on table public.literary_work_cover_artworks is
  'Work-level editorial illustrations with immutable source-archive provenance; never an edition or ISBN claim.';
