-- Save the canonical Russian article row and its optional English translation in
-- one PostgreSQL transaction. Existing revision and public-build outbox triggers
-- remain authoritative and therefore commit or roll back with this function.
--
-- The function is deliberately SECURITY INVOKER: authenticated staff keep the
-- existing RLS checks and no privileged service-role path is introduced.

create or replace function public.save_article_bundle(
  p_article_id uuid,
  p_expected_article_updated_at timestamptz,
  p_article_payload jsonb,
  p_english_mode text default 'none',
  p_english_payload jsonb default null,
  p_expected_english_updated_at timestamptz default null,
  p_redirect_source_path text default null,
  p_redirect_destination_path text default null,
  p_replace_homepage boolean default false,
  p_audit_action text default null,
  p_audit_metadata jsonb default '{}'::jsonb,
  p_social_publish_requested boolean default false,
  p_social_metadata jsonb default '{}'::jsonb
)
returns table (
  article_id uuid,
  article_updated_at timestamptz,
  english_updated_at timestamptz,
  homepage_replaced integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_article public.articles%rowtype;
  current_english public.article_translations%rowtype;
  saved_article public.articles%rowtype;
  saved_english public.article_translations%rowtype;
  has_article boolean := false;
  has_english boolean := false;
  article_keywords text[];
  english_keywords text[];
  replaced_count integer := 0;
  effective_audit_action text;
begin
  if actor_id is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;

  if p_article_payload is null
    or jsonb_typeof(p_article_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'ARTICLE_PAYLOAD_REQUIRED';
  end if;

  if p_english_mode not in ('none', 'save', 'stale') then
    raise exception using errcode = '22023', message = 'INVALID_ENGLISH_MODE';
  end if;

  if p_english_mode = 'save'
    and (p_english_payload is null or jsonb_typeof(p_english_payload) <> 'object') then
    raise exception using errcode = '22023', message = 'ENGLISH_PAYLOAD_REQUIRED';
  end if;

  article_keywords := coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(p_article_payload -> 'seo_keywords', '[]'::jsonb)
      )
    ),
    '{}'::text[]
  );

  if p_english_mode = 'save' then
    english_keywords := coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(p_english_payload -> 'seo_keywords', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    );
  end if;

  -- Lock and validate both rows before the article UPDATE. Updating an article
  -- can legitimately mark a released English translation stale through the
  -- existing sync trigger, which also changes its updated_at. Checking the
  -- English timestamp after that trigger would create a false conflict.
  if p_article_id is not null then
    select *
    into current_article
    from public.articles
    where id = p_article_id
    for update;
    has_article := found;

    if not has_article then
      raise exception using errcode = 'P0001', message = 'ARTICLE_NOT_FOUND';
    end if;

    if p_expected_article_updated_at is null
      or current_article.updated_at is distinct from p_expected_article_updated_at then
      raise exception using errcode = 'P0001', message = 'ARTICLE_CONFLICT';
    end if;

    if p_english_mode in ('save', 'stale') then
      select *
      into current_english
      from public.article_translations
      where article_id = p_article_id
        and locale = 'en'
      for update;
      has_english := found;

      if has_english then
        if p_expected_english_updated_at is null
          or current_english.updated_at is distinct from p_expected_english_updated_at then
          raise exception using errcode = 'P0001', message = 'ENGLISH_CONFLICT';
        end if;
      elsif p_expected_english_updated_at is not null then
        raise exception using errcode = 'P0001', message = 'ENGLISH_CONFLICT';
      end if;
    end if;

    update public.articles
    set
      title = p_article_payload ->> 'title',
      subtitle = coalesce(p_article_payload ->> 'subtitle', ''),
      excerpt = coalesce(p_article_payload ->> 'excerpt', ''),
      slug = p_article_payload ->> 'slug',
      content_html = coalesce(p_article_payload ->> 'content_html', ''),
      content_json = coalesce(
        p_article_payload -> 'content_json',
        '{"type":"doc","content":[]}'::jsonb
      ),
      category_id = nullif(p_article_payload ->> 'category_id', '')::uuid,
      status = (p_article_payload ->> 'status')::public.article_status,
      scheduled_at = nullif(p_article_payload ->> 'scheduled_at', '')::timestamptz,
      published_at = nullif(p_article_payload ->> 'published_at', '')::timestamptz,
      cover_external_url = nullif(p_article_payload ->> 'cover_external_url', ''),
      cover_alt = coalesce(p_article_payload ->> 'cover_alt', ''),
      legacy_path = nullif(p_article_payload ->> 'legacy_path', ''),
      seo_title = nullif(p_article_payload ->> 'seo_title', ''),
      seo_description = nullif(p_article_payload ->> 'seo_description', ''),
      seo_keywords = article_keywords,
      canonical_url = nullif(p_article_payload ->> 'canonical_url', ''),
      og_title = nullif(p_article_payload ->> 'og_title', ''),
      og_description = nullif(p_article_payload ->> 'og_description', ''),
      allow_indexing = coalesce((p_article_payload ->> 'allow_indexing')::boolean, true),
      sources = coalesce(p_article_payload -> 'sources', '[]'::jsonb),
      bibliography = coalesce(p_article_payload -> 'bibliography', '[]'::jsonb),
      featured = coalesce((p_article_payload ->> 'featured')::boolean, false),
      show_on_homepage = coalesce(
        (p_article_payload ->> 'show_on_homepage')::boolean,
        false
      ),
      pinned = coalesce((p_article_payload ->> 'pinned')::boolean, false),
      updated_by = actor_id
    where id = p_article_id
    returning * into saved_article;
  else
    if p_expected_article_updated_at is not null then
      raise exception using errcode = 'P0001', message = 'ARTICLE_CONFLICT';
    end if;

    insert into public.articles (
      title,
      subtitle,
      excerpt,
      slug,
      content_html,
      content_json,
      category_id,
      status,
      scheduled_at,
      published_at,
      cover_external_url,
      cover_alt,
      legacy_path,
      seo_title,
      seo_description,
      seo_keywords,
      canonical_url,
      og_title,
      og_description,
      allow_indexing,
      sources,
      bibliography,
      featured,
      show_on_homepage,
      pinned,
      created_by,
      updated_by
    ) values (
      p_article_payload ->> 'title',
      coalesce(p_article_payload ->> 'subtitle', ''),
      coalesce(p_article_payload ->> 'excerpt', ''),
      p_article_payload ->> 'slug',
      coalesce(p_article_payload ->> 'content_html', ''),
      coalesce(
        p_article_payload -> 'content_json',
        '{"type":"doc","content":[]}'::jsonb
      ),
      nullif(p_article_payload ->> 'category_id', '')::uuid,
      (p_article_payload ->> 'status')::public.article_status,
      nullif(p_article_payload ->> 'scheduled_at', '')::timestamptz,
      nullif(p_article_payload ->> 'published_at', '')::timestamptz,
      nullif(p_article_payload ->> 'cover_external_url', ''),
      coalesce(p_article_payload ->> 'cover_alt', ''),
      nullif(p_article_payload ->> 'legacy_path', ''),
      nullif(p_article_payload ->> 'seo_title', ''),
      nullif(p_article_payload ->> 'seo_description', ''),
      article_keywords,
      nullif(p_article_payload ->> 'canonical_url', ''),
      nullif(p_article_payload ->> 'og_title', ''),
      nullif(p_article_payload ->> 'og_description', ''),
      coalesce((p_article_payload ->> 'allow_indexing')::boolean, true),
      coalesce(p_article_payload -> 'sources', '[]'::jsonb),
      coalesce(p_article_payload -> 'bibliography', '[]'::jsonb),
      coalesce((p_article_payload ->> 'featured')::boolean, false),
      coalesce((p_article_payload ->> 'show_on_homepage')::boolean, false),
      coalesce((p_article_payload ->> 'pinned')::boolean, false),
      actor_id,
      actor_id
    )
    returning * into saved_article;
  end if;

  if p_english_mode = 'save' then
    if has_english then
      update public.article_translations
      set
        title = p_english_payload ->> 'title',
        subtitle = coalesce(p_english_payload ->> 'subtitle', ''),
        excerpt = coalesce(p_english_payload ->> 'excerpt', ''),
        content_json = coalesce(
          p_english_payload -> 'content_json',
          '{"type":"doc","content":[]}'::jsonb
        ),
        content_html = coalesce(p_english_payload ->> 'content_html', ''),
        cover_alt = coalesce(p_english_payload ->> 'cover_alt', ''),
        slug = p_english_payload ->> 'slug',
        sources = coalesce(p_english_payload -> 'sources', '[]'::jsonb),
        bibliography = coalesce(
          p_english_payload -> 'bibliography',
          '[]'::jsonb
        ),
        seo_title = nullif(p_english_payload ->> 'seo_title', ''),
        seo_description = nullif(p_english_payload ->> 'seo_description', ''),
        seo_keywords = english_keywords,
        canonical_url = nullif(p_english_payload ->> 'canonical_url', ''),
        og_title = nullif(p_english_payload ->> 'og_title', ''),
        og_description = nullif(p_english_payload ->> 'og_description', ''),
        status = (p_english_payload ->> 'status')::public.article_translation_status,
        source_content_hash = nullif(
          p_english_payload ->> 'source_content_hash',
          ''
        ),
        source_article_updated_at = saved_article.updated_at,
        reviewed_by = case
          when nullif(p_english_payload ->> 'reviewed_at', '') is null
            then null
          else actor_id
        end,
        reviewed_at = nullif(p_english_payload ->> 'reviewed_at', '')::timestamptz,
        approved_by = case
          when nullif(p_english_payload ->> 'approved_at', '') is null
            then null
          else actor_id
        end,
        approved_at = nullif(p_english_payload ->> 'approved_at', '')::timestamptz,
        published_at = nullif(p_english_payload ->> 'published_at', '')::timestamptz,
        updated_by = actor_id,
        deleted_at = nullif(p_english_payload ->> 'deleted_at', '')::timestamptz
      where id = current_english.id
      returning * into saved_english;
    else
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
        deleted_at
      ) values (
        saved_article.id,
        'en',
        p_english_payload ->> 'title',
        coalesce(p_english_payload ->> 'subtitle', ''),
        coalesce(p_english_payload ->> 'excerpt', ''),
        coalesce(
          p_english_payload -> 'content_json',
          '{"type":"doc","content":[]}'::jsonb
        ),
        coalesce(p_english_payload ->> 'content_html', ''),
        coalesce(p_english_payload ->> 'cover_alt', ''),
        p_english_payload ->> 'slug',
        coalesce(p_english_payload -> 'sources', '[]'::jsonb),
        coalesce(p_english_payload -> 'bibliography', '[]'::jsonb),
        nullif(p_english_payload ->> 'seo_title', ''),
        nullif(p_english_payload ->> 'seo_description', ''),
        english_keywords,
        nullif(p_english_payload ->> 'canonical_url', ''),
        nullif(p_english_payload ->> 'og_title', ''),
        nullif(p_english_payload ->> 'og_description', ''),
        (p_english_payload ->> 'status')::public.article_translation_status,
        nullif(p_english_payload ->> 'source_content_hash', ''),
        saved_article.updated_at,
        case
          when nullif(p_english_payload ->> 'reviewed_at', '') is null
            then null
          else actor_id
        end,
        nullif(p_english_payload ->> 'reviewed_at', '')::timestamptz,
        case
          when nullif(p_english_payload ->> 'approved_at', '') is null
            then null
          else actor_id
        end,
        nullif(p_english_payload ->> 'approved_at', '')::timestamptz,
        nullif(p_english_payload ->> 'published_at', '')::timestamptz,
        actor_id,
        actor_id,
        nullif(p_english_payload ->> 'deleted_at', '')::timestamptz
      )
      returning * into saved_english;
    end if;
  elsif p_english_mode = 'stale' and has_english then
    update public.article_translations
    set
      status = 'stale',
      approved_by = null,
      approved_at = null,
      published_at = null,
      updated_by = actor_id
    where id = current_english.id
    returning * into saved_english;
  end if;

  if nullif(trim(coalesce(p_redirect_source_path, '')), '') is not null
    and nullif(trim(coalesce(p_redirect_destination_path, '')), '') is not null
    and p_redirect_source_path is distinct from p_redirect_destination_path then
    insert into public.redirects (
      source_path,
      destination_path,
      status_code,
      is_active,
      created_by
    ) values (
      p_redirect_source_path,
      p_redirect_destination_path,
      301,
      true,
      actor_id
    )
    on conflict (source_path) do update set
      destination_path = excluded.destination_path,
      status_code = 301,
      is_active = true,
      created_by = actor_id;
  end if;

  if p_replace_homepage
    and saved_article.status = 'published'
    and saved_article.show_on_homepage
    and saved_article.category_id is not null then
    update public.articles
    set
      show_on_homepage = false,
      updated_by = actor_id
    where category_id = saved_article.category_id
      and status = 'published'
      and show_on_homepage
      and id <> saved_article.id;
    get diagnostics replaced_count = row_count;
  end if;

  effective_audit_action := coalesce(
    nullif(trim(coalesce(p_audit_action, '')), ''),
    case when p_article_id is null then 'article.created' else 'article.updated' end
  );

  insert into public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor_id,
    effective_audit_action,
    'article',
    saved_article.id::text,
    coalesce(p_audit_metadata, '{}'::jsonb)
  );

  if p_social_publish_requested then
    insert into public.admin_audit_log (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      actor_id,
      'social_publish.requested',
      'article',
      saved_article.id::text,
      coalesce(p_social_metadata, '{}'::jsonb)
    );
  end if;

  return query
  select
    saved_article.id,
    saved_article.updated_at,
    case
      when p_english_mode in ('save', 'stale') and saved_english.id is not null
        then saved_english.updated_at
      else null
    end,
    replaced_count;
end;
$$;

revoke all on function public.save_article_bundle(
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  boolean,
  text,
  jsonb,
  boolean,
  jsonb
) from public;
grant execute on function public.save_article_bundle(
  uuid,
  timestamptz,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  boolean,
  text,
  jsonb,
  boolean,
  jsonb
) to authenticated;

-- Keep the staff-only schema health probe synchronized with this canonical RPC.
create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then jsonb_build_object(
      'version', '20260822_zz_atomic_article_bundle',
      'checkedAt', now(),
      'outbox', to_regclass('public.public_build_outbox') is not null,
      'outboxRpc',
        to_regprocedure(
          'public.enqueue_public_build_request(text,text,text,jsonb)'
        ) is not null,
      'articleBundleRpc',
        to_regprocedure(
          'public.save_article_bundle(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'
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
            (tablename = 'articles' and policyname = 'Staff read articles')
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
