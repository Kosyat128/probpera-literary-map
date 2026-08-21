-- Canonical staff read access for editorial rows hidden from public readers.
-- Public SELECT policies remain unchanged; authenticated staff receive a
-- separate permissive path for drafts, translations and hidden media metadata.

drop policy if exists "Staff read articles" on public.articles;
create policy "Staff read articles"
on public.articles for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read article translations"
  on public.article_translations;
create policy "Staff read article translations"
on public.article_translations for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read media metadata" on public.media_assets;
create policy "Staff read media metadata"
on public.media_assets for select
to authenticated
using (public.is_staff());

-- Keep the staff-only schema-health contract current after making the
-- editorial read policies part of the canonical migration ledger.
create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then jsonb_build_object(
      'version', '20260822_staff_editorial_read_rls',
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
      'staffEditorialReadPolicies', (
        select count(*) = 3
        from pg_catalog.pg_policies
        where schemaname = 'public'
          and cmd = 'SELECT'
          and roles = array['authenticated'::name]
          and position('is_staff' in coalesce(qual, '')) > 0
          and (
            (
              tablename = 'articles'
              and policyname = 'Staff read articles'
            )
            or (
              tablename = 'article_translations'
              and policyname = 'Staff read article translations'
            )
            or (
              tablename = 'media_assets'
              and policyname = 'Staff read media metadata'
            )
          )
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
