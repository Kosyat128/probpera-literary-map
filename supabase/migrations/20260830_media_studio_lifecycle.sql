-- Phase 4: recoverable Media Studio lifecycle and authoritative dependency graph.
--
-- Storage objects remain immutable to ordinary authenticated requests. A
-- staged owner-only purge removes an exact object through the trusted server,
-- then finalizes metadata deletion only after Storage confirms its absence.

do $$
begin
  create type public.media_rights_status as enum (
    'verified',
    'editorial',
    'public-domain',
    'licensed',
    'unknown'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.media_assets
  add column if not exists rights_status public.media_rights_status
    not null default 'unknown'::public.media_rights_status,
  add column if not exists sha256_hex text
    check (sha256_hex is null or sha256_hex ~ '^[0-9a-f]{64}$'),
  add column if not exists deleted_by uuid
    references auth.users(id) on delete set null,
  add column if not exists replacement_of_media_id uuid
    references public.media_assets(id) on delete restrict,
  add column if not exists replaced_by_media_id uuid
    references public.media_assets(id) on delete restrict,
  add column if not exists replacement_registered_at timestamptz,
  add column if not exists replacement_registered_by uuid
    references auth.users(id) on delete set null,
  add column if not exists purge_token uuid,
  add column if not exists purge_requested_at timestamptz,
  add column if not exists purge_requested_by uuid
    references auth.users(id) on delete set null;

alter table public.media_assets
  drop constraint if exists media_assets_purge_state_consistent;
alter table public.media_assets
  add constraint media_assets_purge_state_consistent check (
    (purge_token is null and purge_requested_at is null and purge_requested_by is null)
    or
    (purge_token is not null and purge_requested_at is not null and purge_requested_by is not null)
  );

alter table public.media_assets
  drop constraint if exists media_assets_replacement_not_self;
alter table public.media_assets
  add constraint media_assets_replacement_not_self check (
    (replacement_of_media_id is null or replacement_of_media_id <> id)
    and (replaced_by_media_id is null or replaced_by_media_id <> id)
  );
alter table public.media_assets
  drop constraint if exists media_assets_replacement_timestamp_consistent;
alter table public.media_assets
  add constraint media_assets_replacement_timestamp_consistent check (
    (
      replacement_of_media_id is null
      and replaced_by_media_id is null
      and replacement_registered_at is null
    )
    or (
      (replacement_of_media_id is not null or replaced_by_media_id is not null)
      and replacement_registered_at is not null
    )
  );

create index if not exists media_assets_sha256_idx
  on public.media_assets(sha256_hex)
  where sha256_hex is not null;
create unique index if not exists media_assets_replacement_of_unique_idx
  on public.media_assets(replacement_of_media_id)
  where replacement_of_media_id is not null;
create unique index if not exists media_assets_replaced_by_unique_idx
  on public.media_assets(replaced_by_media_id)
  where replaced_by_media_id is not null;
create index if not exists media_assets_trash_idx
  on public.media_assets(deleted_at desc, id)
  where deleted_at is not null;
create index if not exists media_assets_rights_idx
  on public.media_assets(rights_status, created_at desc)
  where deleted_at is null;

-- One internal graph covers explicit usage rows, direct foreign keys, rich-text
-- media IDs, private recovery copies and every revision that may be restored.
-- It is intentionally not executable through PostgREST.
create or replace function public.media_asset_usage_refs_internal(
  p_media_ids uuid[]
)
returns table (
  media_id uuid,
  entity_type text,
  entity_id text,
  field_name text,
  is_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct requested_id as media_id
    from unnest(coalesce(p_media_ids, '{}'::uuid[])) requested_id
  )
  select usage.media_id, usage.entity_type, usage.entity_id::text,
    usage.field_name, false
  from public.media_usages usage
  join requested on requested.media_id = usage.media_id

  union
  select requested.media_id, 'article', article.id::text, 'cover_media_id', false
  from requested
  join public.articles article on article.cover_media_id = requested.media_id

  union
  select requested.media_id, 'article', article.id::text, 'og_media_id', false
  from requested
  join public.articles article on article.og_media_id = requested.media_id

  union
  select requested.media_id, 'homepage', block.id::text,
    'background_media_id', false
  from requested
  join public.homepage_blocks block
    on block.background_media_id = requested.media_id

  union
  select requested.media_id, 'banner', banner.id::text,
    'desktop_media_id', false
  from requested
  join public.banners banner on banner.desktop_media_id = requested.media_id

  union
  select requested.media_id, 'banner', banner.id::text,
    'tablet_media_id', false
  from requested
  join public.banners banner on banner.tablet_media_id = requested.media_id

  union
  select requested.media_id, 'banner', banner.id::text,
    'mobile_media_id', false
  from requested
  join public.banners banner on banner.mobile_media_id = requested.media_id

  union
  select requested.media_id, 'article_revision', revision.article_id::text,
    'revision:' || revision.revision_number::text, true
  from requested
  join public.article_revisions revision
    on position(requested.media_id::text in revision.snapshot::text) > 0

  union
  select requested.media_id, 'article_translation_revision',
    translation.article_id::text,
    'content:' || translation.locale || ':revision:'
      || revision.revision_number::text, true
  from requested
  join public.article_translation_revisions revision
    on position(requested.media_id::text in revision.snapshot::text) > 0
  join public.article_translations translation
    on translation.id = revision.article_translation_id

  union
  select requested.media_id, 'page_revision', revision.page_id::text,
    'revision:' || revision.revision_number::text, true
  from requested
  join public.page_revisions revision
    on position(requested.media_id::text in revision.snapshot::text) > 0

  union
  select requested.media_id, 'homepage_revision',
    coalesce(revision.homepage_block_id::text, revision.id::text),
    'revision:' || revision.revision_number::text, true
  from requested
  join public.homepage_block_revisions revision
    on position(requested.media_id::text in revision.snapshot::text) > 0

  union
  select requested.media_id, 'chrome_revision', revision.entity_id::text,
    revision.entity_type || ':revision:' || revision.id::text, true
  from requested
  join public.site_chrome_revisions revision
    on position(requested.media_id::text in revision.snapshot::text) > 0

  union
  select requested.media_id, 'editor_autosave',
    coalesce(autosave.entity_id::text, autosave.id::text),
    autosave.entity_type || ':recovery', true
  from requested
  join public.editor_autosaves autosave
    on autosave.expires_at > now()
    and position(requested.media_id::text in autosave.snapshot::text) > 0;
$$;

revoke all on function public.media_asset_usage_refs_internal(uuid[])
  from public, anon, authenticated;

create or replace function public.guard_pending_purge_snapshot_refs_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.media_assets asset
    where asset.purge_token is not null
      and position(asset.id::text in new.snapshot::text) > 0
  ) then
    raise exception 'snapshot references media pending permanent purge'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_pending_purge_snapshot_refs_trigger()
  from public, anon, authenticated;

drop trigger if exists article_revisions_guard_pending_media_purge
  on public.article_revisions;
create trigger article_revisions_guard_pending_media_purge
  before insert or update of snapshot on public.article_revisions
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();
drop trigger if exists article_translation_revisions_guard_pending_media_purge
  on public.article_translation_revisions;
create trigger article_translation_revisions_guard_pending_media_purge
  before insert or update of snapshot on public.article_translation_revisions
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();
drop trigger if exists page_revisions_guard_pending_media_purge
  on public.page_revisions;
create trigger page_revisions_guard_pending_media_purge
  before insert or update of snapshot on public.page_revisions
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();
drop trigger if exists homepage_block_revisions_guard_pending_media_purge
  on public.homepage_block_revisions;
create trigger homepage_block_revisions_guard_pending_media_purge
  before insert or update of snapshot on public.homepage_block_revisions
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();
drop trigger if exists site_chrome_revisions_guard_pending_media_purge
  on public.site_chrome_revisions;
create trigger site_chrome_revisions_guard_pending_media_purge
  before insert or update of snapshot on public.site_chrome_revisions
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();
drop trigger if exists editor_autosaves_guard_pending_media_purge
  on public.editor_autosaves;
create trigger editor_autosaves_guard_pending_media_purge
  before insert or update of snapshot, expires_at on public.editor_autosaves
  for each row execute function public.guard_pending_purge_snapshot_refs_trigger();

-- Extract only authoritative TipTap image media IDs. URL-only legacy images
-- remain readable, while a malformed non-empty mediaId fails the save instead
-- of silently weakening dependency protection.
create or replace function public.editor_media_ids_from_json(
  p_document jsonb
)
returns setof uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  child jsonb;
  raw_media_id text;
  parsed_media_id uuid;
begin
  if p_document is null then
    return;
  end if;

  if jsonb_typeof(p_document) = 'object' then
    raw_media_id := nullif(btrim(p_document ->> 'mediaId'), '');
    if raw_media_id is not null then
      begin
        parsed_media_id := raw_media_id::uuid;
      exception
        when invalid_text_representation then
          raise exception 'editor mediaId must be a UUID'
            using errcode = '22023';
      end;
      return next parsed_media_id;
    end if;

    for child in select value from jsonb_each(p_document)
    loop
      return query select * from public.editor_media_ids_from_json(child);
    end loop;
  elsif jsonb_typeof(p_document) = 'array' then
    for child in select value from jsonb_array_elements(p_document)
    loop
      return query select * from public.editor_media_ids_from_json(child);
    end loop;
  end if;
end;
$$;

revoke all on function public.editor_media_ids_from_json(jsonb) from public;

-- Parse only the bounded, sanitized data-media-id attribute contract from the
-- rendered HTML. Any non-empty malformed value rejects the write instead of
-- silently diverging from the authoritative TipTap JSON.
create or replace function public.editor_media_ids_from_html(
  p_html text
)
returns setof uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  attribute_match text[];
  raw_media_id text;
  parsed_media_id uuid;
  scrubbed_html text;
  attribute_pattern constant text :=
    $media_id_regex$data-media-id[[:space:]]*=[[:space:]]*("([^"]*)"|'([^']*)'|([^[:space:]>"']+))$media_id_regex$;
begin
  if p_html is null then
    return;
  end if;
  if char_length(p_html) > 2000000 then
    raise exception 'editor HTML is too large for media identity validation'
      using errcode = '22023';
  end if;

  for attribute_match in
    select regexp_matches(p_html, attribute_pattern, 'gi')
  loop
    raw_media_id := btrim(coalesce(
      attribute_match[2],
      attribute_match[3],
      attribute_match[4],
      ''
    ));
    if raw_media_id = '' then
      continue;
    end if;
    if char_length(raw_media_id) > 80 then
      raise exception 'editor HTML data-media-id is too long'
        using errcode = '22023';
    end if;
    begin
      parsed_media_id := raw_media_id::uuid;
    exception
      when invalid_text_representation then
        raise exception 'editor HTML data-media-id must be a UUID'
          using errcode = '22023';
    end;
    return next parsed_media_id;
  end loop;

  scrubbed_html := regexp_replace(p_html, attribute_pattern, '', 'gi');
  if scrubbed_html ~* $media_id_assignment$data-media-id[[:space:]]*=$media_id_assignment$ then
    raise exception 'editor HTML contains a malformed data-media-id attribute'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.editor_media_ids_from_html(text) from public;

create or replace function public.normalize_editor_media_source_url(
  p_source_url text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(
    coalesce(p_source_url, ''),
    '&(amp|#0*38|#x0*26);',
    '&',
    'gi'
  )), '');
$$;

revoke all on function public.normalize_editor_media_source_url(text)
  from public, anon, authenticated;

create or replace function public.editor_media_refs_from_json(
  p_document jsonb
)
returns table (media_id uuid, source_url text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  child jsonb;
  raw_media_id text;
  parsed_media_id uuid;
begin
  if p_document is null then
    return;
  end if;

  if jsonb_typeof(p_document) = 'object' then
    raw_media_id := nullif(btrim(p_document ->> 'mediaId'), '');
    if raw_media_id is not null then
      begin
        parsed_media_id := raw_media_id::uuid;
      exception
        when invalid_text_representation then
          raise exception 'editor mediaId must be a UUID'
            using errcode = '22023';
      end;
      return query select parsed_media_id,
        public.normalize_editor_media_source_url(p_document ->> 'src');
    end if;

    for child in select value from jsonb_each(p_document)
    loop
      return query select * from public.editor_media_refs_from_json(child);
    end loop;
  elsif jsonb_typeof(p_document) = 'array' then
    for child in select value from jsonb_array_elements(p_document)
    loop
      return query select * from public.editor_media_refs_from_json(child);
    end loop;
  end if;
end;
$$;

revoke all on function public.editor_media_refs_from_json(jsonb)
  from public, anon, authenticated;

create or replace function public.editor_media_refs_from_html(
  p_html text
)
returns table (occurrence_index integer, media_id uuid, source_url text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  remaining_html text := coalesce(p_html, '');
  image_tag text;
  image_position integer;
  tag_media_ids uuid[];
  source_match text[];
  parsed_source_url text;
  returned_count integer := 0;
  image_tag_pattern constant text :=
    $image_tag_regex$(?i)<img[[:space:]][^>]*>$image_tag_regex$;
  source_attribute_pattern constant text :=
    $source_regex$(^|[[:space:]])src[[:space:]]*=[[:space:]]*("([^"]*)"|'([^']*)'|([^[:space:]>"']+))$source_regex$;
begin
  if p_html is null then
    return;
  end if;

  loop
    image_tag := substring(remaining_html from image_tag_pattern);
    exit when image_tag is null;
    image_position := strpos(remaining_html, image_tag);
    remaining_html := substr(
      remaining_html,
      image_position + char_length(image_tag)
    );

    select array_agg(parsed_media_id)
    into tag_media_ids
    from public.editor_media_ids_from_html(image_tag) parsed_media_id;
    if coalesce(cardinality(tag_media_ids), 0) = 0 then
      continue;
    end if;
    if cardinality(tag_media_ids) <> 1 then
      raise exception 'editor image must contain exactly one data-media-id'
        using errcode = '23514';
    end if;

    source_match := regexp_match(image_tag, source_attribute_pattern, 'i');
    parsed_source_url := case when source_match is null then null else
      public.normalize_editor_media_source_url(coalesce(
        source_match[3], source_match[4], source_match[5], ''
      ))
    end;
    returned_count := returned_count + 1;
    return query select returned_count, tag_media_ids[1], parsed_source_url;
  end loop;
end;
$$;

revoke all on function public.editor_media_refs_from_html(text)
  from public, anon, authenticated;

create or replace function public.editor_media_identity_sets_match(
  p_document jsonb,
  p_html text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    (
      select media_id, source_url, count(*) as occurrence_count
      from public.editor_media_refs_from_json(p_document)
      group by media_id, source_url
      except
      select media_id, source_url, count(*) as occurrence_count
      from public.editor_media_refs_from_html(p_html)
      group by media_id, source_url
    )
    union all
    (
      select media_id, source_url, count(*) as occurrence_count
      from public.editor_media_refs_from_html(p_html)
      group by media_id, source_url
      except
      select media_id, source_url, count(*) as occurrence_count
      from public.editor_media_refs_from_json(p_document)
      group by media_id, source_url
    )
  );
$$;

revoke all on function public.editor_media_identity_sets_match(jsonb, text)
  from public;

create or replace function public.sync_editor_media_usage_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entity_type text;
  target_entity_id uuid;
  target_scope text;
  previous_scope text;
  media_ids uuid[];
begin
  if tg_table_name = 'articles' then
    target_entity_type := 'article';
    target_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
    target_scope := 'content:ru';
    previous_scope := target_scope;
  elsif tg_table_name = 'article_translations' then
    target_entity_type := 'article';
    target_entity_id := case
      when tg_op = 'DELETE' then old.article_id else new.article_id
    end;
    target_scope := 'content:' || case
      when tg_op = 'DELETE' then old.locale else new.locale
    end;
    previous_scope := 'content:' || case
      when tg_op = 'INSERT' then new.locale else old.locale
    end;
  elsif tg_table_name = 'pages' then
    target_entity_type := 'page';
    target_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
    target_scope := 'content:ru';
    previous_scope := target_scope;
  else
    raise exception 'unsupported editor media usage source'
      using errcode = '22023';
  end if;

  if tg_op = 'DELETE' then
    delete from public.media_usages usage
    where usage.entity_type = target_entity_type
      and usage.entity_id = target_entity_id
      and usage.field_name = previous_scope;
    return old;
  end if;

  if previous_scope <> target_scope then
    delete from public.media_usages usage
    where usage.entity_type = target_entity_type
      and usage.entity_id = target_entity_id
      and usage.field_name = previous_scope;
  end if;

  if not public.editor_media_identity_sets_match(
    new.content_json,
    new.content_html
  ) then
    raise exception 'editor JSON and HTML media identity sets do not match'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct media_id), '{}'::uuid[])
  into media_ids
  from public.editor_media_ids_from_json(new.content_json) media_id;

  -- Serialize a content save with trash_media_asset. A plain visibility check
  -- can otherwise observe the pre-trash row while the trash transaction holds
  -- an uncommitted UPDATE lock and commit a new reference afterwards.
  perform asset.id
  from public.media_assets asset
  where asset.id = any(media_ids)
  order by asset.id
  for share;

  if exists (
    select 1
    from unnest(media_ids) requested(media_id)
    left join public.media_assets asset
      on asset.id = requested.media_id and asset.deleted_at is null
    where asset.id is null
  ) then
    raise exception 'editor content references missing or trashed media'
      using errcode = '23503';
  end if;

  delete from public.media_usages usage
  where usage.entity_type = target_entity_type
    and usage.entity_id = target_entity_id
    and usage.field_name = target_scope
    and not (usage.media_id = any(media_ids));

  insert into public.media_usages (
    media_id, entity_type, entity_id, field_name
  )
  select media_id, target_entity_type, target_entity_id, target_scope
  from unnest(media_ids) media_id
  on conflict (media_id, entity_type, entity_id, field_name) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_editor_media_usage_trigger() from public;

-- Direct media foreign keys need the same active-asset contract as TipTap
-- content. Row locks make stale forms and trash serialize deterministically.
create or replace function public.guard_active_direct_media_refs_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  media_ids uuid[];
begin
  if tg_table_name = 'articles' then
    media_ids := array_remove(array[new.cover_media_id, new.og_media_id], null);
  elsif tg_table_name = 'homepage_blocks' then
    media_ids := array_remove(array[new.background_media_id], null);
  elsif tg_table_name = 'banners' then
    media_ids := array_remove(array[
      new.desktop_media_id,
      new.tablet_media_id,
      new.mobile_media_id
    ], null);
  else
    raise exception 'unsupported direct media reference source'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct media_id order by media_id), '{}'::uuid[])
  into media_ids
  from unnest(media_ids) media_id;

  perform asset.id
  from public.media_assets asset
  where asset.id = any(media_ids)
  order by asset.id
  for share;

  if exists (
    select 1
    from unnest(media_ids) requested(media_id)
    left join public.media_assets asset
      on asset.id = requested.media_id and asset.deleted_at is null
    where asset.id is null
  ) then
    raise exception 'direct reference targets missing or trashed media'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_active_direct_media_refs_trigger()
  from public, anon, authenticated;

drop trigger if exists articles_sync_editor_media_usage on public.articles;
create trigger articles_sync_editor_media_usage
  after insert or update of content_json, content_html on public.articles
  for each row execute function public.sync_editor_media_usage_trigger();
drop trigger if exists articles_guard_active_direct_media_refs
  on public.articles;
create trigger articles_guard_active_direct_media_refs
  before insert or update of cover_media_id, og_media_id on public.articles
  for each row execute function public.guard_active_direct_media_refs_trigger();
drop trigger if exists articles_delete_editor_media_usage on public.articles;
create trigger articles_delete_editor_media_usage
  after delete on public.articles
  for each row execute function public.sync_editor_media_usage_trigger();

drop trigger if exists article_translations_sync_editor_media_usage
  on public.article_translations;
create trigger article_translations_sync_editor_media_usage
  after insert or update of content_json, content_html, locale
  on public.article_translations
  for each row execute function public.sync_editor_media_usage_trigger();
drop trigger if exists article_translations_delete_editor_media_usage
  on public.article_translations;
create trigger article_translations_delete_editor_media_usage
  after delete on public.article_translations
  for each row execute function public.sync_editor_media_usage_trigger();

drop trigger if exists pages_sync_editor_media_usage on public.pages;
create trigger pages_sync_editor_media_usage
  after insert or update of content_json, content_html on public.pages
  for each row execute function public.sync_editor_media_usage_trigger();
drop trigger if exists pages_delete_editor_media_usage on public.pages;
create trigger pages_delete_editor_media_usage
  after delete on public.pages
  for each row execute function public.sync_editor_media_usage_trigger();

drop trigger if exists homepage_blocks_guard_active_direct_media_refs
  on public.homepage_blocks;
create trigger homepage_blocks_guard_active_direct_media_refs
  before insert or update of background_media_id on public.homepage_blocks
  for each row execute function public.guard_active_direct_media_refs_trigger();

drop trigger if exists banners_guard_active_direct_media_refs on public.banners;
create trigger banners_guard_active_direct_media_refs
  before insert or update of desktop_media_id, tablet_media_id, mobile_media_id
  on public.banners
  for each row execute function public.guard_active_direct_media_refs_trigger();

-- Older premium EN rows intentionally stored generated HTML beside an empty
-- fallback TipTap document. Preserve the premium metadata and add only a
-- deterministic top-level occurrence manifest. Non-empty/divergent documents
-- remain fail-closed in the guard below.
update public.article_translations translation
set content_json = jsonb_set(
  translation.content_json,
  '{__probperaMediaReferences}',
  (
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'mediaId', media_ref.media_id::text,
        'src', media_ref.source_url
      ))
      order by media_ref.occurrence_index
    )
    from public.editor_media_refs_from_html(
      translation.content_html
    ) media_ref
  ),
  true
)
where translation.locale = 'en'
  and translation.content_json ? '__probperaPremiumTranslation'
  and translation.content_json ->> 'type' = 'doc'
  and case
    when not (translation.content_json ? 'content') then true
    when jsonb_typeof(translation.content_json -> 'content') = 'array'
      then jsonb_array_length(translation.content_json -> 'content') = 0
    else false
  end
  and not exists (
    select 1
    from public.editor_media_refs_from_json(
      translation.content_json
    ) media_ref
  )
  and exists (
    select 1
    from public.editor_media_refs_from_html(
      translation.content_html
    ) media_ref
  );

do $media_identity_backfill_guard$
begin
  if exists (
      select 1
      from public.articles article
      where not public.editor_media_identity_sets_match(
        article.content_json, article.content_html
      )
    ) or exists (
      select 1
      from public.article_translations translation
      where not public.editor_media_identity_sets_match(
        translation.content_json, translation.content_html
      )
    ) or exists (
      select 1
      from public.pages page
      where not public.editor_media_identity_sets_match(
        page.content_json, page.content_html
      )
    ) then
    raise exception 'existing editor JSON and HTML media identity sets do not match'
      using errcode = '23514';
  end if;
  if exists (
      select 1
      from public.articles article
      cross join lateral public.editor_media_ids_from_json(
        article.content_json
      ) media_id
      left join public.media_assets asset
        on asset.id = media_id and asset.deleted_at is null
      where asset.id is null
    ) or exists (
      select 1
      from public.article_translations translation
      cross join lateral public.editor_media_ids_from_json(
        translation.content_json
      ) media_id
      left join public.media_assets asset
        on asset.id = media_id and asset.deleted_at is null
      where asset.id is null
    ) or exists (
      select 1
      from public.pages page
      cross join lateral public.editor_media_ids_from_json(
        page.content_json
      ) media_id
      left join public.media_assets asset
        on asset.id = media_id and asset.deleted_at is null
      where asset.id is null
    ) then
    raise exception 'existing editor content references missing or trashed media'
      using errcode = '23503';
  end if;
  if exists (
      select 1
      from public.articles article
      cross join lateral unnest(array[
        article.cover_media_id,
        article.og_media_id
      ]) requested(media_id)
      left join public.media_assets asset
        on asset.id = requested.media_id and asset.deleted_at is null
      where requested.media_id is not null and asset.id is null
    ) or exists (
      select 1
      from public.homepage_blocks block
      left join public.media_assets asset
        on asset.id = block.background_media_id and asset.deleted_at is null
      where block.background_media_id is not null and asset.id is null
    ) or exists (
      select 1
      from public.banners banner
      cross join lateral unnest(array[
        banner.desktop_media_id,
        banner.tablet_media_id,
        banner.mobile_media_id
      ]) requested(media_id)
      left join public.media_assets asset
        on asset.id = requested.media_id and asset.deleted_at is null
      where requested.media_id is not null and asset.id is null
    ) then
    raise exception 'existing direct reference targets missing or trashed media'
      using errcode = '23503';
  end if;
end;
$media_identity_backfill_guard$;

-- Optional reconciliation RPC. Its payload is the complete content usage set
-- for one entity: [{"media_id":"<uuid>","field_name":"content:ru"}].
create or replace function public.sync_media_usages(
  p_entity_type text,
  p_entity_id uuid,
  p_usages jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_count integer;
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_entity_type not in ('article', 'page') then
    raise exception 'unsupported media usage entity type'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_usages) <> 'array'
    or jsonb_array_length(p_usages) > 200 then
    raise exception 'media usages must be an array of at most 200 rows'
      using errcode = '22023';
  end if;
  if (p_entity_type = 'article' and not exists (
      select 1 from public.articles where id = p_entity_id
    )) or (p_entity_type = 'page' and not exists (
      select 1 from public.pages where id = p_entity_id
    )) then
    raise exception 'media usage entity not found' using errcode = 'P0002';
  end if;

  create temporary table if not exists next_media_usages (
    media_id uuid not null,
    field_name text not null,
    primary key (media_id, field_name)
  ) on commit drop;
  delete from pg_temp.next_media_usages;

  insert into pg_temp.next_media_usages (media_id, field_name)
  select distinct
    nullif(btrim(item.media_id), '')::uuid,
    nullif(btrim(item.field_name), '')
  from jsonb_to_recordset(p_usages) as item(
    media_id text,
    field_name text
  );

  if exists (
    select 1 from pg_temp.next_media_usages usage
    where usage.field_name is null
      or char_length(usage.field_name) > 80
      or usage.field_name !~ '^[a-z][a-z0-9:_-]*$'
  ) then
    raise exception 'invalid media usage field name' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_temp.next_media_usages usage
    left join public.media_assets asset
      on asset.id = usage.media_id and asset.deleted_at is null
    where asset.id is null
  ) then
    raise exception 'media usage references missing or trashed media'
      using errcode = '23503';
  end if;

  select count(*) into parsed_count from pg_temp.next_media_usages;

  delete from public.media_usages usage
  where usage.entity_type = p_entity_type
    and usage.entity_id = p_entity_id
    and (usage.field_name = 'content' or usage.field_name like 'content:%')
    and not exists (
      select 1 from pg_temp.next_media_usages incoming
      where incoming.media_id = usage.media_id
        and incoming.field_name = usage.field_name
    );

  insert into public.media_usages (
    media_id, entity_type, entity_id, field_name
  )
  select usage.media_id, p_entity_type, p_entity_id, usage.field_name
  from pg_temp.next_media_usages usage
  on conflict (media_id, entity_type, entity_id, field_name) do nothing;

  return parsed_count;
end;
$$;

-- Rich-text triggers are authoritative. Keep this reconciliation helper
-- unavailable through PostgREST so direct usage-row edits cannot weaken trash.
revoke all on function public.sync_media_usages(text, uuid, jsonb)
  from public, anon, authenticated;

-- Backfill only verified active IDs. Future writes are fail-closed through the
-- triggers above; legacy URL-only nodes intentionally produce no usage row.
insert into public.media_usages (media_id, entity_type, entity_id, field_name)
select distinct media_id, 'article', article.id, 'content:ru'
from public.articles article
cross join lateral public.editor_media_ids_from_json(article.content_json) media_id
join public.media_assets asset on asset.id = media_id and asset.deleted_at is null
on conflict (media_id, entity_type, entity_id, field_name) do nothing;

insert into public.media_usages (media_id, entity_type, entity_id, field_name)
select distinct media_id, 'article', translation.article_id,
  'content:' || translation.locale
from public.article_translations translation
cross join lateral public.editor_media_ids_from_json(translation.content_json) media_id
join public.media_assets asset on asset.id = media_id and asset.deleted_at is null
on conflict (media_id, entity_type, entity_id, field_name) do nothing;

insert into public.media_usages (media_id, entity_type, entity_id, field_name)
select distinct media_id, 'page', page.id, 'content:ru'
from public.pages page
cross join lateral public.editor_media_ids_from_json(page.content_json) media_id
join public.media_assets asset on asset.id = media_id and asset.deleted_at is null
on conflict (media_id, entity_type, entity_id, field_name) do nothing;

create or replace function public.list_media_asset_usages(
  p_media_ids uuid[]
)
returns table (
  media_id uuid,
  entity_type text,
  entity_id text,
  field_name text,
  is_revision boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_media_ids is null
    or cardinality(p_media_ids) < 1
    or cardinality(p_media_ids) > 100 then
    raise exception 'between 1 and 100 media IDs are required'
      using errcode = '22023';
  end if;

  return query
  select usage.media_id, usage.entity_type, usage.entity_id,
    usage.field_name, usage.is_revision
  from public.media_asset_usage_refs_internal(p_media_ids) usage
  order by usage.media_id, usage.is_revision, usage.entity_type,
    usage.entity_id, usage.field_name;
end;
$$;

revoke all on function public.list_media_asset_usages(uuid[]) from public;
grant execute on function public.list_media_asset_usages(uuid[])
  to authenticated;

-- Server-side filtering keeps pagination honest. "Unused" means no current
-- placement; the trash RPC additionally checks recovery and revision history
-- through the stricter authoritative graph above.
create or replace function public.list_media_studio_assets(
  p_state text default 'active',
  p_search_column text default 'alt_text',
  p_search_pattern text default null,
  p_offset integer default 0,
  p_limit integer default 48
)
returns table (
  id uuid,
  bucket text,
  object_path text,
  original_name text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  alt_text text,
  caption text,
  creator text,
  source_url text,
  license_name text,
  license_url text,
  focus_x numeric,
  focus_y numeric,
  collection_name text,
  uploaded_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  rights_status public.media_rights_status,
  sha256_hex text,
  deleted_by uuid,
  replacement_of_media_id uuid,
  replaced_by_media_id uuid,
  replacement_registered_at timestamptz,
  replacement_registered_by uuid,
  usage_count bigint,
  duplicate_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_state not in ('active', 'unused', 'trash') then
    raise exception 'invalid media state filter' using errcode = '22023';
  end if;
  if p_search_column not in (
    'alt_text', 'creator', 'collection_name', 'object_path', 'license_name'
  ) then
    raise exception 'invalid media search column' using errcode = '22023';
  end if;
  if p_offset < 0 or p_offset > 500000
    or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid media page bounds' using errcode = '22023';
  end if;

  return query
  with current_usage_refs as (
    select usage.media_id, usage.entity_type, usage.entity_id::text,
      usage.field_name
    from public.media_usages usage
    union
    select article.cover_media_id, 'article', article.id::text,
      'cover_media_id'
    from public.articles article where article.cover_media_id is not null
    union
    select article.og_media_id, 'article', article.id::text, 'og_media_id'
    from public.articles article where article.og_media_id is not null
    union
    select block.background_media_id, 'homepage', block.id::text,
      'background_media_id'
    from public.homepage_blocks block
    where block.background_media_id is not null
    union
    select banner.desktop_media_id, 'banner', banner.id::text,
      'desktop_media_id'
    from public.banners banner where banner.desktop_media_id is not null
    union
    select banner.tablet_media_id, 'banner', banner.id::text,
      'tablet_media_id'
    from public.banners banner where banner.tablet_media_id is not null
    union
    select banner.mobile_media_id, 'banner', banner.id::text,
      'mobile_media_id'
    from public.banners banner where banner.mobile_media_id is not null
  ), usage_counts as (
    select usage.media_id, count(*)::bigint as usage_count
    from current_usage_refs usage group by usage.media_id
  ), filtered as (
    select
      asset.*,
      coalesce(usage.usage_count, 0)::bigint as resolved_usage_count,
      case
        when asset.sha256_hex is null then 0::bigint
        else (
          select count(*)::bigint
          from public.media_assets duplicate
          where duplicate.sha256_hex = asset.sha256_hex
        )
      end as resolved_duplicate_count
    from public.media_assets asset
    left join usage_counts usage on usage.media_id = asset.id
    where (
      (p_state = 'active' and asset.deleted_at is null)
      or (p_state = 'unused' and asset.deleted_at is null
        and coalesce(usage.usage_count, 0) = 0)
      or (p_state = 'trash' and asset.deleted_at is not null)
    )
    and (
      nullif(p_search_pattern, '') is null
      or case p_search_column
        when 'alt_text' then asset.alt_text ilike p_search_pattern
        when 'creator' then asset.creator ilike p_search_pattern
        when 'collection_name' then asset.collection_name ilike p_search_pattern
        when 'object_path' then asset.object_path ilike p_search_pattern
        when 'license_name' then asset.license_name ilike p_search_pattern
        else false
      end
    )
  ), counted as (
    select filtered.*, count(*) over ()::bigint as resolved_total_count
    from filtered
  )
  select
    counted.id, counted.bucket, counted.object_path, counted.original_name,
    counted.mime_type, counted.byte_size, counted.width, counted.height,
    counted.alt_text, counted.caption, counted.creator, counted.source_url,
    counted.license_name, counted.license_url, counted.focus_x,
    counted.focus_y, counted.collection_name, counted.uploaded_by,
    counted.created_at, counted.updated_at, counted.deleted_at,
    counted.rights_status, counted.sha256_hex, counted.deleted_by,
    counted.replacement_of_media_id, counted.replaced_by_media_id,
    counted.replacement_registered_at,
    counted.replacement_registered_by, counted.resolved_usage_count,
    counted.resolved_duplicate_count, counted.resolved_total_count
  from counted
  order by counted.created_at desc, counted.id desc
  offset p_offset
  limit p_limit;
end;
$$;

revoke all on function public.list_media_studio_assets(
  text, text, text, integer, integer
) from public;
grant execute on function public.list_media_studio_assets(
  text, text, text, integer, integer
) to authenticated;

create or replace function public.trash_media_asset(
  p_media_id uuid,
  p_expected_updated_at timestamptz
)
returns table (media_id uuid, deleted_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.media_assets%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;

  select * into current_asset
  from public.media_assets asset
  where asset.id = p_media_id
  for update;
  if not found then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;
  if current_asset.deleted_at is not null then
    raise exception 'media asset is already in trash' using errcode = '55000';
  end if;
  if current_asset.updated_at is distinct from p_expected_updated_at then
    raise exception 'media asset changed in another session' using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.media_asset_usage_refs_internal(array[p_media_id]) usage
  ) then
    raise exception 'media asset is still in use' using errcode = '23503';
  end if;

  update public.media_assets asset
  set deleted_at = now(), deleted_by = actor_id
  where asset.id = p_media_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.trashed', 'media', p_media_id::text,
    jsonb_build_object(
      'objectPath', current_asset.object_path,
      'physicalObjectDeleted', false
    )
  );

  return query
  select asset.id, asset.deleted_at, asset.updated_at
  from public.media_assets asset
  where asset.id = p_media_id;
end;
$$;

revoke all on function public.trash_media_asset(uuid, timestamptz) from public;
grant execute on function public.trash_media_asset(uuid, timestamptz)
  to authenticated;

create or replace function public.restore_media_asset(
  p_media_id uuid,
  p_expected_updated_at timestamptz
)
returns table (media_id uuid, deleted_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.media_assets%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;

  select * into current_asset
  from public.media_assets asset
  where asset.id = p_media_id
  for update;
  if not found then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;
  if current_asset.deleted_at is null then
    raise exception 'media asset is not in trash' using errcode = '55000';
  end if;
  if current_asset.purge_token is not null then
    raise exception 'media purge is pending; restore aborted' using errcode = '55000';
  end if;
  if current_asset.updated_at is distinct from p_expected_updated_at then
    raise exception 'media asset changed in another session' using errcode = '40001';
  end if;
  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = current_asset.bucket
      and object.name = current_asset.object_path
  ) then
    raise exception 'media storage object is missing; restore aborted'
      using errcode = '23503';
  end if;

  update public.media_assets asset
  set deleted_at = null, deleted_by = null
  where asset.id = p_media_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.restored', 'media', p_media_id::text,
    jsonb_build_object('objectPath', current_asset.object_path)
  );

  return query
  select asset.id, asset.deleted_at, asset.updated_at
  from public.media_assets asset
  where asset.id = p_media_id;
end;
$$;

revoke all on function public.restore_media_asset(uuid, timestamptz)
  from public;
grant execute on function public.restore_media_asset(uuid, timestamptz)
  to authenticated;

create or replace function public.prepare_media_asset_purge(
  p_media_id uuid,
  p_expected_updated_at timestamptz
)
returns table (
  media_id uuid,
  purge_token uuid,
  bucket text,
  object_path text,
  prepared_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.media_assets%rowtype;
  requested_token uuid := gen_random_uuid();
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role
  ]) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select * into current_asset
  from public.media_assets asset
  where asset.id = p_media_id
  for update;
  if not found then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;
  if current_asset.updated_at is distinct from p_expected_updated_at then
    raise exception 'media asset changed in another session' using errcode = '40001';
  end if;
  if current_asset.deleted_at is null
    or current_asset.deleted_at > now() - interval '30 days' then
    raise exception 'media asset retention period has not elapsed'
      using errcode = '55000';
  end if;
  if current_asset.bucket <> 'editorial-media'
    or current_asset.object_path is null
    or char_length(current_asset.object_path) not between 1 and 1024
    or current_asset.object_path <> btrim(current_asset.object_path)
    or current_asset.object_path like '/%'
    or current_asset.object_path ~ '(^|/)\.\.(/|$)'
    or current_asset.object_path ~ '[[:cntrl:]\\]' then
    raise exception 'media storage identity is not canonical'
      using errcode = '23514';
  end if;
  if current_asset.purge_token is not null
    and current_asset.purge_requested_by = actor_id then
    return query select asset.id, asset.purge_token, asset.bucket,
      asset.object_path, asset.updated_at
    from public.media_assets asset where asset.id = p_media_id;
    return;
  end if;
  if current_asset.purge_token is not null then
    raise exception 'media purge is already pending' using errcode = '55000';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = current_asset.bucket
      and object.name = current_asset.object_path
  ) then
    raise exception 'media storage object is missing; purge preparation aborted'
      using errcode = '23503';
  end if;
  lock table public.media_usages, public.articles, public.article_translations,
    public.pages, public.homepage_blocks, public.banners,
    public.article_revisions, public.article_translation_revisions,
    public.page_revisions, public.homepage_block_revisions,
    public.site_chrome_revisions, public.editor_autosaves in share mode;
  if exists (
    select 1
    from public.media_asset_usage_refs_internal(array[p_media_id]) usage
  ) or current_asset.replacement_of_media_id is not null
    or current_asset.replaced_by_media_id is not null
    or exists (
    select 1
    from public.media_assets linked
    where linked.id <> p_media_id
      and (linked.replacement_of_media_id = p_media_id
        or linked.replaced_by_media_id = p_media_id)
  ) then
    raise exception 'media asset has current or historical dependencies'
      using errcode = '23503';
  end if;

  update public.media_assets asset
  set purge_token = requested_token,
      purge_requested_at = now(),
      purge_requested_by = actor_id
  where asset.id = p_media_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.purge_prepared', 'media', p_media_id::text,
    jsonb_build_object(
      'bucket', current_asset.bucket,
      'objectPath', current_asset.object_path,
      'deletedAt', current_asset.deleted_at,
      'retentionDays', 30,
      'purgeToken', requested_token
    )
  );

  return query select asset.id, asset.purge_token, asset.bucket,
    asset.object_path, asset.updated_at
  from public.media_assets asset where asset.id = p_media_id;
end;
$$;

revoke all on function public.prepare_media_asset_purge(uuid, timestamptz)
  from public, anon;
grant execute on function public.prepare_media_asset_purge(uuid, timestamptz)
  to authenticated;

create or replace function public.cancel_media_asset_purge(
  p_media_id uuid,
  p_purge_token uuid,
  p_expected_updated_at timestamptz
)
returns table (media_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.media_assets%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role
  ]) then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  select * into current_asset from public.media_assets asset
  where asset.id = p_media_id for update;
  if not found then raise exception 'media asset not found' using errcode = 'P0002'; end if;
  if current_asset.updated_at is distinct from p_expected_updated_at
    or current_asset.purge_token is distinct from p_purge_token then
    raise exception 'media purge token or version changed' using errcode = '40001';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = current_asset.bucket
      and object.name = current_asset.object_path
  ) then
    raise exception 'storage object was removed; finalize purge instead'
      using errcode = '55000';
  end if;
  update public.media_assets asset
  set purge_token = null, purge_requested_at = null, purge_requested_by = null
  where asset.id = p_media_id;
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.purge_cancelled', 'media', p_media_id::text,
    jsonb_build_object('bucket', current_asset.bucket,
      'objectPath', current_asset.object_path,
      'purgeToken', p_purge_token)
  );
  return query select asset.id, asset.updated_at
  from public.media_assets asset where asset.id = p_media_id;
end;
$$;

revoke all on function public.cancel_media_asset_purge(uuid, uuid, timestamptz)
  from public, anon;
grant execute on function public.cancel_media_asset_purge(uuid, uuid, timestamptz)
  to authenticated;

create or replace function public.finalize_media_asset_purge(
  p_media_id uuid,
  p_purge_token uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.media_assets%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role
  ]) then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  select * into current_asset from public.media_assets asset
  where asset.id = p_media_id for update;
  if not found then raise exception 'media asset not found' using errcode = 'P0002'; end if;
  if current_asset.updated_at is distinct from p_expected_updated_at
    or current_asset.purge_token is distinct from p_purge_token then
    raise exception 'media purge token or version changed' using errcode = '40001';
  end if;
  lock table public.media_usages, public.articles, public.article_translations,
    public.pages, public.homepage_blocks, public.banners,
    public.article_revisions, public.article_translation_revisions,
    public.page_revisions, public.homepage_block_revisions,
    public.site_chrome_revisions, public.editor_autosaves in share mode;
  if exists (
    select 1 from storage.objects object
    where object.bucket_id = current_asset.bucket
      and object.name = current_asset.object_path
  ) then
    raise exception 'media storage object still exists; purge not finalized'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.media_asset_usage_refs_internal(array[p_media_id]) usage
  ) or current_asset.replacement_of_media_id is not null
    or current_asset.replaced_by_media_id is not null
    or exists (
    select 1 from public.media_assets linked
    where linked.id <> p_media_id
      and (linked.replacement_of_media_id = p_media_id
        or linked.replaced_by_media_id = p_media_id)
  ) then
    raise exception 'media asset acquired a dependency during purge'
      using errcode = '23503';
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.purged', 'media', p_media_id::text,
    jsonb_build_object(
      'bucket', current_asset.bucket,
      'objectPath', current_asset.object_path,
      'sha256', current_asset.sha256_hex,
      'deletedAt', current_asset.deleted_at,
      'purgePreparedAt', current_asset.purge_requested_at,
      'physicalObjectDeleted', true
    )
  );
  delete from public.media_assets asset where asset.id = p_media_id;
  return p_media_id;
end;
$$;

revoke all on function public.finalize_media_asset_purge(uuid, uuid, timestamptz)
  from public, anon;
grant execute on function public.finalize_media_asset_purge(uuid, uuid, timestamptz)
  to authenticated;

create or replace function public.register_media_replacement(
  p_old_media_id uuid,
  p_new_media_id uuid,
  p_expected_old_updated_at timestamptz,
  p_expected_new_updated_at timestamptz
)
returns table (old_media_id uuid, new_media_id uuid, registered_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  old_asset public.media_assets%rowtype;
  new_asset public.media_assets%rowtype;
  registered_at_value timestamptz := now();
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  if p_old_media_id = p_new_media_id then
    raise exception 'replacement must be a different media asset'
      using errcode = '22023';
  end if;

  perform asset.id
  from public.media_assets asset
  where asset.id in (p_old_media_id, p_new_media_id)
  order by asset.id
  for update;

  select * into old_asset from public.media_assets where id = p_old_media_id;
  select * into new_asset from public.media_assets where id = p_new_media_id;
  if old_asset.id is null or new_asset.id is null then
    raise exception 'replacement media asset not found' using errcode = 'P0002';
  end if;
  if old_asset.deleted_at is not null or new_asset.deleted_at is not null then
    raise exception 'replacement assets must be active' using errcode = '55000';
  end if;
  if old_asset.updated_at is distinct from p_expected_old_updated_at
    or new_asset.updated_at is distinct from p_expected_new_updated_at then
    raise exception 'replacement asset changed in another session'
      using errcode = '40001';
  end if;
  if new_asset.sha256_hex is null then
    raise exception 'replacement asset must have a verified SHA-256 digest'
      using errcode = '23514';
  end if;
  if old_asset.sha256_hex is not null
    and old_asset.sha256_hex = new_asset.sha256_hex then
    raise exception 'replacement asset has identical content'
      using errcode = '23514';
  end if;
  if old_asset.replaced_by_media_id is not null
    or new_asset.replacement_of_media_id is not null then
    raise exception 'replacement lineage is already registered'
      using errcode = '23505';
  end if;

  update public.media_assets
  set
    replaced_by_media_id = p_new_media_id,
    replacement_registered_at = registered_at_value,
    replacement_registered_by = actor_id
  where id = p_old_media_id;

  update public.media_assets
  set
    replacement_of_media_id = p_old_media_id,
    replacement_registered_at = registered_at_value,
    replacement_registered_by = actor_id
  where id = p_new_media_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.replacement_registered', 'media', p_old_media_id::text,
    jsonb_build_object(
      'replacementMediaId', p_new_media_id,
      'usageMutationPerformed', false,
      'oldObjectRetained', true
    )
  );

  return query select p_old_media_id, p_new_media_id, registered_at_value;
end;
$$;

revoke all on function public.register_media_replacement(
  uuid, uuid, timestamptz, timestamptz
) from public, anon, authenticated;

-- Only current editable placements participate in Safe Replace. Historical
-- revisions and autosaves are deliberately absent and therefore immutable.
create or replace function public.media_asset_current_replacement_refs_internal(
  p_media_id uuid
)
returns table (
  entity_type text,
  entity_id uuid,
  field_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select 'article', article.id, 'content:ru'
  from public.articles article
  where p_media_id in (
    select media_id
    from public.editor_media_ids_from_json(article.content_json) media_id
  )

  union
  select 'article', translation.article_id, 'content:' || translation.locale
  from public.article_translations translation
  where p_media_id in (
    select media_id
    from public.editor_media_ids_from_json(translation.content_json) media_id
  )

  union
  select 'page', page.id, 'content:ru'
  from public.pages page
  where p_media_id in (
    select media_id
    from public.editor_media_ids_from_json(page.content_json) media_id
  )

  union
  select 'article', article.id, 'cover_media_id'
  from public.articles article
  where article.cover_media_id = p_media_id

  union
  select 'article', article.id, 'og_media_id'
  from public.articles article
  where article.og_media_id = p_media_id

  union
  select 'homepage', block.id, 'background_media_id'
  from public.homepage_blocks block
  where block.background_media_id = p_media_id

  union
  select 'banner', banner.id, 'desktop_media_id'
  from public.banners banner
  where banner.desktop_media_id = p_media_id

  union
  select 'banner', banner.id, 'tablet_media_id'
  from public.banners banner
  where banner.tablet_media_id = p_media_id

  union
  select 'banner', banner.id, 'mobile_media_id'
  from public.banners banner
  where banner.mobile_media_id = p_media_id;
$$;

revoke all on function public.media_asset_current_replacement_refs_internal(uuid)
  from public, anon, authenticated;

create or replace function public.media_replacement_usage_refs_json(
  p_media_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entity_type', usage.entity_type,
        'entity_id', usage.entity_id,
        'field_name', usage.field_name
      ) order by usage.entity_type, usage.entity_id, usage.field_name
    ),
    '[]'::jsonb
  )
  from public.media_asset_current_replacement_refs_internal(p_media_id) usage;
$$;

revoke all on function public.media_replacement_usage_refs_json(uuid)
  from public, anon, authenticated;

-- Recursively rewrites only a TipTap/media object whose authoritative
-- mediaId matches. URL-only legacy nodes remain readable and are not guessed.
create or replace function public.replace_editor_media_node_json(
  p_value jsonb,
  p_old_media_id uuid,
  p_new_media_id uuid,
  p_new_public_url text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  rewritten jsonb;
begin
  if p_value is null then
    return null;
  end if;
  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(
      public.replace_editor_media_node_json(
        element, p_old_media_id, p_new_media_id, p_new_public_url
      ) order by ordinal
    ), '[]'::jsonb)
    into rewritten
    from jsonb_array_elements(p_value) with ordinality valueset(element, ordinal);
    return rewritten;
  end if;
  if jsonb_typeof(p_value) <> 'object' then
    return p_value;
  end if;

  rewritten := '{}'::jsonb;
  for item in select key, value from jsonb_each(p_value)
  loop
    rewritten := rewritten || jsonb_build_object(
      item.key,
      public.replace_editor_media_node_json(
        item.value, p_old_media_id, p_new_media_id, p_new_public_url
      )
    );
  end loop;
  if nullif(btrim(rewritten ->> 'mediaId'), '') = p_old_media_id::text then
    rewritten := jsonb_set(
      rewritten, '{mediaId}', to_jsonb(p_new_media_id::text), true
    );
    if rewritten ? 'src' then
      rewritten := jsonb_set(
        rewritten, '{src}', to_jsonb(p_new_public_url), true
      );
    end if;
  end if;
  return rewritten;
end;
$$;

revoke all on function public.replace_editor_media_node_json(
  jsonb, uuid, uuid, text
) from public, anon, authenticated;

-- Rewrite only an <img> whose authoritative data-media-id matches. This uses
-- the same single-quoted, double-quoted and unquoted attribute grammar as the
-- identity validator; unrelated links and text containing the URL are intact.
create or replace function public.replace_editor_media_html(
  p_html text,
  p_old_media_id uuid,
  p_new_media_id uuid,
  p_new_public_url text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  remaining_html text := coalesce(p_html, '');
  rewritten_html text := '';
  image_tag text;
  rewritten_tag text;
  image_position integer;
  tag_media_count integer;
  tag_matches_old boolean;
  replacement_count integer := 0;
  image_tag_pattern constant text :=
    $image_tag_regex$(?i)<img[[:space:]][^>]*>$image_tag_regex$;
  media_attribute_pattern constant text :=
    $media_id_regex$(^|[[:space:]])data-media-id[[:space:]]*=[[:space:]]*("[^"]*"|'[^']*'|[^[:space:]>"']+)$media_id_regex$;
  source_attribute_pattern constant text :=
    $source_regex$(^|[[:space:]])src[[:space:]]*=[[:space:]]*("[^"]*"|'[^']*'|[^[:space:]>"']+)$source_regex$;
begin
  if p_html is null then
    return null;
  end if;
  if p_new_public_url !~ E'^https://[^[:space:]<>"''\\\\]+$' then
    raise exception 'replacement public URL is unsafe for an HTML attribute'
      using errcode = '22023';
  end if;

  loop
    image_tag := substring(remaining_html from image_tag_pattern);
    exit when image_tag is null;
    image_position := strpos(remaining_html, image_tag);
    rewritten_html := rewritten_html
      || substr(remaining_html, 1, image_position - 1);
    remaining_html := substr(
      remaining_html,
      image_position + char_length(image_tag)
    );

    select count(*), coalesce(bool_or(media_id = p_old_media_id), false)
    into tag_media_count, tag_matches_old
    from public.editor_media_ids_from_html(image_tag) media_id;

    if not tag_matches_old then
      rewritten_html := rewritten_html || image_tag;
      continue;
    end if;
    if tag_media_count <> 1 then
      raise exception 'editor image must contain exactly one data-media-id'
        using errcode = '23514';
    end if;

    rewritten_tag := regexp_replace(
      image_tag,
      media_attribute_pattern,
      E'\\1data-media-id="' || p_new_media_id::text || '"',
      'i'
    );
    if rewritten_tag ~* source_attribute_pattern then
      rewritten_tag := regexp_replace(
        rewritten_tag,
        source_attribute_pattern,
        E'\\1src="' || p_new_public_url || '"',
        'i'
      );
    elsif right(rewritten_tag, 2) = '/>' then
      rewritten_tag := left(rewritten_tag, char_length(rewritten_tag) - 2)
        || ' src="' || p_new_public_url || '" />';
    else
      rewritten_tag := left(rewritten_tag, char_length(rewritten_tag) - 1)
        || ' src="' || p_new_public_url || '">';
    end if;

    if not exists (
        select 1
        from public.editor_media_refs_from_html(rewritten_tag) media_ref
        where media_ref.media_id = p_new_media_id
          and media_ref.source_url = p_new_public_url
      ) then
      raise exception 'media HTML replacement postcondition failed'
        using errcode = '23514';
    end if;

    replacement_count := replacement_count + 1;
    rewritten_html := rewritten_html || rewritten_tag;
  end loop;

  rewritten_html := rewritten_html || remaining_html;
  if replacement_count = 0
    or exists (
      select 1
      from public.editor_media_refs_from_html(rewritten_html) media_ref
      where media_ref.media_id = p_old_media_id
    ) then
    raise exception 'media HTML replacement was incomplete'
      using errcode = '23514';
  end if;
  return rewritten_html;
end;
$$;

revoke all on function public.replace_editor_media_html(text, uuid, uuid, text)
  from public, anon, authenticated;

create or replace function public.preview_media_asset_replacement(
  p_old_media_id uuid,
  p_new_media_id uuid
)
returns table (
  old_media_id uuid,
  new_media_id uuid,
  old_updated_at timestamptz,
  new_updated_at timestamptz,
  new_original_name text,
  new_alt_text text,
  new_sha256_hex text,
  current_usage_refs jsonb,
  history_usage_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  old_asset public.media_assets%rowtype;
  new_asset public.media_assets%rowtype;
begin
  if (select auth.uid()) is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  if p_old_media_id = p_new_media_id then
    raise exception 'replacement must be a different media asset'
      using errcode = '22023';
  end if;

  select * into old_asset from public.media_assets where id = p_old_media_id;
  select * into new_asset from public.media_assets where id = p_new_media_id;
  if old_asset.id is null or new_asset.id is null then
    raise exception 'replacement media asset not found' using errcode = 'P0002';
  end if;
  if old_asset.deleted_at is not null or new_asset.deleted_at is not null then
    raise exception 'replacement assets must be active' using errcode = '55000';
  end if;
  if new_asset.sha256_hex is null then
    raise exception 'replacement asset must have a verified SHA-256 digest'
      using errcode = '23514';
  end if;
  if old_asset.sha256_hex is not null
    and old_asset.sha256_hex = new_asset.sha256_hex then
    raise exception 'replacement asset has identical content'
      using errcode = '23514';
  end if;
  if old_asset.replaced_by_media_id is not null
    and old_asset.replaced_by_media_id <> p_new_media_id then
    raise exception 'old media already has another replacement'
      using errcode = '23505';
  end if;
  if new_asset.replacement_of_media_id is not null
    and new_asset.replacement_of_media_id <> p_old_media_id then
    raise exception 'new media already replaces another asset'
      using errcode = '23505';
  end if;
  if new_asset.replaced_by_media_id is not null then
    raise exception 'new media is itself superseded' using errcode = '23505';
  end if;

  return query
  select
    old_asset.id,
    new_asset.id,
    old_asset.updated_at,
    new_asset.updated_at,
    new_asset.original_name,
    new_asset.alt_text,
    new_asset.sha256_hex,
    public.media_replacement_usage_refs_json(old_asset.id),
    (
      select count(*)
      from public.media_asset_usage_refs_internal(array[old_asset.id]) usage
      where usage.is_revision
    );
end;
$$;

revoke all on function public.preview_media_asset_replacement(uuid, uuid)
  from public;
grant execute on function public.preview_media_asset_replacement(uuid, uuid)
  to authenticated;

create or replace function public.replace_media_asset_current_usages(
  p_old_media_id uuid,
  p_new_media_id uuid,
  p_expected_old_updated_at timestamptz,
  p_expected_new_updated_at timestamptz,
  p_expected_usage_refs jsonb,
  p_selected_usage_refs jsonb,
  p_replace_all_current boolean,
  p_old_public_url text,
  p_new_public_url text
)
returns table (
  old_media_id uuid,
  new_media_id uuid,
  replaced_usage_count integer,
  retained_history_count bigint,
  registered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  old_asset public.media_assets%rowtype;
  new_asset public.media_assets%rowtype;
  replacement_time timestamptz := now();
  target_count integer;
  public_url_origin text;
  persisted_old_public_url text;
  persisted_old_public_url_max text;
  persisted_ref_count bigint;
  expected_old_public_url text;
  expected_new_public_url text;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  if p_old_media_id = p_new_media_id then
    raise exception 'replacement must be a different media asset'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_expected_usage_refs) <> 'array'
    or jsonb_array_length(p_expected_usage_refs) > 500
    or jsonb_typeof(p_selected_usage_refs) <> 'array'
    or jsonb_array_length(p_selected_usage_refs) > 500 then
    raise exception 'replacement usage references must be arrays of at most 500 rows'
      using errcode = '22023';
  end if;
  if p_old_public_url !~ E'^https://[^[:space:]<>"''\\\\]+$'
    or p_new_public_url !~ E'^https://[^[:space:]<>"''\\\\]+$' then
    raise exception 'replacement public URLs must be HTTPS'
      using errcode = '22023';
  end if;

  perform asset.id
  from public.media_assets asset
  where asset.id in (p_old_media_id, p_new_media_id)
  order by asset.id
  for update;
  select * into old_asset from public.media_assets where id = p_old_media_id;
  select * into new_asset from public.media_assets where id = p_new_media_id;
  if old_asset.id is null or new_asset.id is null then
    raise exception 'replacement media asset not found' using errcode = 'P0002';
  end if;
  if old_asset.deleted_at is not null or new_asset.deleted_at is not null then
    raise exception 'replacement assets must be active' using errcode = '55000';
  end if;
  if old_asset.updated_at is distinct from p_expected_old_updated_at
    or new_asset.updated_at is distinct from p_expected_new_updated_at then
    raise exception 'replacement asset changed in another session'
      using errcode = '40001';
  end if;
  if new_asset.sha256_hex is null then
    raise exception 'replacement asset must have a verified SHA-256 digest'
      using errcode = '23514';
  end if;
  if old_asset.sha256_hex is not null
    and old_asset.sha256_hex = new_asset.sha256_hex then
    raise exception 'replacement asset has identical content'
      using errcode = '23514';
  end if;
  if (old_asset.bucket, old_asset.object_path)
    = (new_asset.bucket, new_asset.object_path) then
    raise exception 'replacement asset must use a new immutable object'
      using errcode = '23514';
  end if;
  if not exists (
      select 1 from storage.objects object
      where object.bucket_id = old_asset.bucket
        and object.name = old_asset.object_path
    ) or not exists (
      select 1 from storage.objects object
      where object.bucket_id = new_asset.bucket
        and object.name = new_asset.object_path
    ) then
    raise exception 'replacement storage object is missing'
      using errcode = '23503';
  end if;
  if old_asset.replaced_by_media_id is not null
    and old_asset.replaced_by_media_id <> p_new_media_id then
    raise exception 'old media already has another replacement'
      using errcode = '23505';
  end if;
  if new_asset.replacement_of_media_id is not null
    and new_asset.replacement_of_media_id <> p_old_media_id then
    raise exception 'new media already replaces another asset'
      using errcode = '23505';
  end if;
  if new_asset.replaced_by_media_id is not null then
    raise exception 'new media is itself superseded' using errcode = '23505';
  end if;

  -- Replacement is rare and high impact. A short table-level write lock closes
  -- the race where an editor adds a new reference after preview but before the
  -- selected set is applied.
  lock table public.articles, public.article_translations, public.pages,
    public.homepage_blocks, public.banners in share row exclusive mode;

  create temporary table if not exists current_media_replacement_refs (
    entity_type text not null,
    entity_id uuid not null,
    field_name text not null,
    primary key (entity_type, entity_id, field_name)
  ) on commit drop;
  create temporary table if not exists expected_media_replacement_refs (
    entity_type text not null,
    entity_id uuid not null,
    field_name text not null,
    primary key (entity_type, entity_id, field_name)
  ) on commit drop;
  create temporary table if not exists target_media_replacement_refs (
    entity_type text not null,
    entity_id uuid not null,
    field_name text not null,
    primary key (entity_type, entity_id, field_name)
  ) on commit drop;
  delete from pg_temp.current_media_replacement_refs;
  delete from pg_temp.expected_media_replacement_refs;
  delete from pg_temp.target_media_replacement_refs;

  insert into pg_temp.current_media_replacement_refs
  select usage.entity_type, usage.entity_id, usage.field_name
  from public.media_asset_current_replacement_refs_internal(p_old_media_id) usage;

  insert into pg_temp.expected_media_replacement_refs
    (entity_type, entity_id, field_name)
  select btrim(reference.entity_type), reference.entity_id::uuid,
    btrim(reference.field_name)
  from jsonb_to_recordset(p_expected_usage_refs) reference(
    entity_type text,
    entity_id text,
    field_name text
  );

  if exists (
      select * from pg_temp.current_media_replacement_refs
      except
      select * from pg_temp.expected_media_replacement_refs
    ) or exists (
      select * from pg_temp.expected_media_replacement_refs
      except
      select * from pg_temp.current_media_replacement_refs
    ) then
    raise exception 'media usages changed after preview'
      using errcode = '40001';
  end if;

  if p_replace_all_current then
    insert into pg_temp.target_media_replacement_refs
    select * from pg_temp.current_media_replacement_refs;
  else
    insert into pg_temp.target_media_replacement_refs
      (entity_type, entity_id, field_name)
    select btrim(reference.entity_type), reference.entity_id::uuid,
      btrim(reference.field_name)
    from jsonb_to_recordset(p_selected_usage_refs) reference(
      entity_type text,
      entity_id text,
      field_name text
    );
  end if;

  if exists (
    select 1
    from pg_temp.target_media_replacement_refs target
    where not (
      (target.entity_type = 'article' and (
        target.field_name in ('cover_media_id', 'og_media_id')
        or target.field_name ~ '^content:[a-z]{2}$'
      ))
      or (target.entity_type = 'page' and target.field_name = 'content:ru')
      or (target.entity_type = 'homepage'
        and target.field_name = 'background_media_id')
      or (target.entity_type = 'banner' and target.field_name in (
        'desktop_media_id', 'tablet_media_id', 'mobile_media_id'
      ))
    )
  ) then
    raise exception 'unsupported replacement usage reference'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_temp.target_media_replacement_refs target
    left join pg_temp.current_media_replacement_refs current_ref
      using (entity_type, entity_id, field_name)
    where current_ref.entity_id is null
  ) then
    raise exception 'selected media usage is no longer current'
      using errcode = '40001';
  end if;

  if exists (
      select 1
      from pg_temp.target_media_replacement_refs target
      join public.articles article on article.id = target.entity_id
      cross join lateral public.editor_media_refs_from_json(
        article.content_json
      ) media_ref
      where target.entity_type = 'article'
        and target.field_name = 'content:ru'
        and media_ref.media_id = p_old_media_id
        and media_ref.source_url is distinct from p_old_public_url
    ) or exists (
      select 1
      from pg_temp.target_media_replacement_refs target
      join public.article_translations translation
        on translation.article_id = target.entity_id
        and translation.locale = split_part(target.field_name, ':', 2)
      cross join lateral public.editor_media_refs_from_json(
        translation.content_json
      ) media_ref
      where target.entity_type = 'article'
        and target.field_name ~ '^content:[a-z]{2}$'
        and media_ref.media_id = p_old_media_id
        and media_ref.source_url is distinct from p_old_public_url
    ) or exists (
      select 1
      from pg_temp.target_media_replacement_refs target
      join public.pages page on page.id = target.entity_id
      cross join lateral public.editor_media_refs_from_json(
        page.content_json
      ) media_ref
      where target.entity_type = 'page'
        and target.field_name = 'content:ru'
        and media_ref.media_id = p_old_media_id
        and media_ref.source_url is distinct from p_old_public_url
    ) then
    raise exception 'current media fallback URL does not match immutable object'
      using errcode = '23514';
  end if;

  select count(*) into target_count
  from pg_temp.target_media_replacement_refs;
  if target_count = 0 then
    raise exception 'select at least one current media usage'
      using errcode = '22023';
  end if;

  with persisted_refs as (
    select media_ref.source_url
    from pg_temp.target_media_replacement_refs target
    join public.articles article on article.id = target.entity_id
    cross join lateral public.editor_media_refs_from_json(article.content_json) media_ref
    where target.entity_type = 'article' and target.field_name = 'content:ru'
      and media_ref.media_id = p_old_media_id
    union all
    select media_ref.source_url
    from pg_temp.target_media_replacement_refs target
    join public.article_translations translation
      on translation.article_id = target.entity_id
      and translation.locale = split_part(target.field_name, ':', 2)
    cross join lateral public.editor_media_refs_from_json(translation.content_json) media_ref
    where target.entity_type = 'article'
      and target.field_name ~ '^content:[a-z]{2}$'
      and media_ref.media_id = p_old_media_id
    union all
    select media_ref.source_url
    from pg_temp.target_media_replacement_refs target
    join public.pages page on page.id = target.entity_id
    cross join lateral public.editor_media_refs_from_json(page.content_json) media_ref
    where target.entity_type = 'page' and target.field_name = 'content:ru'
      and media_ref.media_id = p_old_media_id
  )
  select min(source_url), max(source_url), count(*)
  into persisted_old_public_url, persisted_old_public_url_max, persisted_ref_count
  from persisted_refs;

  if persisted_ref_count > 0 then
    if persisted_old_public_url is distinct from persisted_old_public_url_max
      or p_old_public_url is distinct from persisted_old_public_url then
      raise exception 'persisted media fallback URLs are inconsistent'
        using errcode = '23514';
    end if;
    public_url_origin := substring(persisted_old_public_url from '^(https://[^/]+)');
  else
    public_url_origin := substring(p_old_public_url from '^(https://[^/]+)');
  end if;
  if public_url_origin is null
    or public_url_origin !~ '^https://[a-z0-9.-]+(?::[0-9]{1,5})?$' then
    raise exception 'replacement public URL origin is invalid'
      using errcode = '23514';
  end if;
  expected_old_public_url := public_url_origin
    || '/storage/v1/object/public/' || old_asset.bucket || '/' || old_asset.object_path;
  expected_new_public_url := public_url_origin
    || '/storage/v1/object/public/' || new_asset.bucket || '/' || new_asset.object_path;
  if p_old_public_url is distinct from expected_old_public_url
    or p_new_public_url is distinct from expected_new_public_url then
    raise exception 'public URL does not match immutable media object'
      using errcode = '23514';
  end if;

  with selected as (
    select target.entity_id,
      bool_or(target.field_name = 'content:ru') as replace_content,
      bool_or(target.field_name = 'cover_media_id') as replace_cover,
      bool_or(target.field_name = 'og_media_id') as replace_og
    from pg_temp.target_media_replacement_refs target
    where target.entity_type = 'article'
      and target.field_name in ('content:ru', 'cover_media_id', 'og_media_id')
    group by target.entity_id
  )
  update public.articles article
  set
    content_json = case when selected.replace_content then
      public.replace_editor_media_node_json(
        article.content_json, p_old_media_id, p_new_media_id, p_new_public_url
      ) else article.content_json end,
    content_html = case when selected.replace_content then
      public.replace_editor_media_html(
        article.content_html,
        p_old_media_id,
        p_new_media_id,
        p_new_public_url
      ) else article.content_html end,
    cover_media_id = case when selected.replace_cover
      then p_new_media_id else article.cover_media_id end,
    og_media_id = case when selected.replace_og
      then p_new_media_id else article.og_media_id end,
    updated_by = actor_id
  from selected
  where article.id = selected.entity_id;

  with selected as (
    select target.entity_id, split_part(target.field_name, ':', 2) as locale
    from pg_temp.target_media_replacement_refs target
    where target.entity_type = 'article'
      and target.field_name ~ '^content:[a-z]{2}$'
  )
  update public.article_translations translation
  set
    content_json = public.replace_editor_media_node_json(
      translation.content_json,
      p_old_media_id,
      p_new_media_id,
      p_new_public_url
    ),
    content_html = public.replace_editor_media_html(
      translation.content_html,
      p_old_media_id,
      p_new_media_id,
      p_new_public_url
    ),
    updated_by = actor_id
  from selected
  where translation.article_id = selected.entity_id
    and translation.locale = selected.locale;

  update public.pages page
  set
    content_json = public.replace_editor_media_node_json(
      page.content_json, p_old_media_id, p_new_media_id, p_new_public_url
    ),
    content_html = public.replace_editor_media_html(
      page.content_html,
      p_old_media_id,
      p_new_media_id,
      p_new_public_url
    ),
    updated_by = actor_id
  from pg_temp.target_media_replacement_refs target
  where target.entity_type = 'page'
    and target.field_name = 'content:ru'
    and page.id = target.entity_id;

  with selected as (
    select target.entity_id
    from pg_temp.target_media_replacement_refs target
    where target.entity_type = 'homepage'
      and target.field_name = 'background_media_id'
    group by target.entity_id
  )
  update public.homepage_blocks block
  set
    background_media_id = p_new_media_id,
    updated_by = actor_id
  from selected
  where block.id = selected.entity_id;

  with selected as (
    select target.entity_id,
      bool_or(target.field_name = 'desktop_media_id') as replace_desktop,
      bool_or(target.field_name = 'tablet_media_id') as replace_tablet,
      bool_or(target.field_name = 'mobile_media_id') as replace_mobile
    from pg_temp.target_media_replacement_refs target
    where target.entity_type = 'banner'
    group by target.entity_id
  )
  update public.banners banner
  set
    desktop_media_id = case when selected.replace_desktop
      then p_new_media_id else banner.desktop_media_id end,
    tablet_media_id = case when selected.replace_tablet
      then p_new_media_id else banner.tablet_media_id end,
    mobile_media_id = case when selected.replace_mobile
      then p_new_media_id else banner.mobile_media_id end,
    updated_by = actor_id
  from selected
  where banner.id = selected.entity_id;

  -- Preserve any explicit usage rows maintained by older admin surfaces while
  -- the rich-text triggers continue to own Article/Page content rows.
  insert into public.media_usages (
    media_id, entity_type, entity_id, field_name
  )
  select p_new_media_id, usage.entity_type, usage.entity_id, usage.field_name
  from public.media_usages usage
  join pg_temp.target_media_replacement_refs target
    on target.entity_type = usage.entity_type
    and target.entity_id = usage.entity_id
    and target.field_name = usage.field_name
  where usage.media_id = p_old_media_id
  on conflict (media_id, entity_type, entity_id, field_name) do nothing;

  delete from public.media_usages usage
  using pg_temp.target_media_replacement_refs target
  where usage.media_id = p_old_media_id
    and target.entity_type = usage.entity_type
    and target.entity_id = usage.entity_id
    and target.field_name = usage.field_name;

  if exists (
    select 1
    from public.media_asset_current_replacement_refs_internal(p_old_media_id) current_ref
    join pg_temp.target_media_replacement_refs target
      using (entity_type, entity_id, field_name)
  ) then
    raise exception 'one or more media usages could not be replaced atomically'
      using errcode = '40001';
  end if;

  update public.media_assets asset
  set
    replaced_by_media_id = p_new_media_id,
    replacement_registered_at = coalesce(
      asset.replacement_registered_at, replacement_time
    ),
    replacement_registered_by = coalesce(
      asset.replacement_registered_by, actor_id
    )
  where asset.id = p_old_media_id;

  update public.media_assets asset
  set
    replacement_of_media_id = p_old_media_id,
    replacement_registered_at = coalesce(
      asset.replacement_registered_at, replacement_time
    ),
    replacement_registered_by = coalesce(
      asset.replacement_registered_by, actor_id
    )
  where asset.id = p_new_media_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'media.current_usages_replaced', 'media', p_old_media_id::text,
    jsonb_build_object(
      'replacementMediaId', p_new_media_id,
      'selectedUsages', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'entity_type', target.entity_type,
          'entity_id', target.entity_id,
          'field_name', target.field_name
        ) order by target.entity_type, target.entity_id, target.field_name), '[]'::jsonb)
        from pg_temp.target_media_replacement_refs target
      ),
      'replaceAllCurrent', p_replace_all_current,
      'oldSha256', old_asset.sha256_hex,
      'newSha256', new_asset.sha256_hex,
      'oldObjectRetained', true,
      'historicalRevisionsMutated', false
    )
  );

  return query
  select
    p_old_media_id,
    p_new_media_id,
    target_count,
    (
      select count(*)
      from public.media_asset_usage_refs_internal(array[p_old_media_id]) usage
      where usage.is_revision
    ),
    replacement_time;
end;
$$;

revoke all on function public.replace_media_asset_current_usages(
  uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, boolean, text, text
) from public;
grant execute on function public.replace_media_asset_current_usages(
  uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, boolean, text, text
) to authenticated;

-- Lifecycle columns are RPC-only; editorial metadata remains directly
-- editable under the existing staff RLS policy.
revoke update on table public.media_assets from authenticated;
grant update (
  alt_text,
  caption,
  creator,
  source_url,
  license_name,
  license_url,
  focus_x,
  focus_y,
  collection_name,
  rights_status
) on table public.media_assets to authenticated;
revoke insert on table public.media_assets from authenticated;
grant insert (
  object_path,
  original_name,
  mime_type,
  byte_size,
  width,
  height,
  alt_text,
  caption,
  creator,
  source_url,
  license_name,
  license_url,
  focus_x,
  focus_y,
  collection_name,
  uploaded_by,
  rights_status,
  sha256_hex
) on table public.media_assets to authenticated;
revoke delete on table public.media_assets from authenticated;
drop policy if exists "Staff delete media metadata" on public.media_assets;

-- Usage rows are maintained only by trusted triggers. The former broad staff
-- policy allowed a caller to delete a dependency immediately before trash.
-- Staff retain a read-only inspection path; Media Studio normally reads the
-- authoritative graph through its bounded RPC.
revoke all on table public.media_usages from public, anon;
revoke insert, update, delete on table public.media_usages
  from authenticated;
grant select on table public.media_usages to authenticated;
drop policy if exists "Staff manage media usage" on public.media_usages;
drop policy if exists "Staff read media usage" on public.media_usages;
create policy "Staff read media usage"
on public.media_usages for select
to authenticated
using (public.is_staff());

-- Immutable object paths: authenticated users may upload a new version but
-- cannot overwrite or physically remove any historical Storage object.
-- The isolated public-schema restore drill intentionally omits Supabase's
-- storage schema. Keep its application-schema replay valid, while production
-- remains fail-closed through the schema-health policy checks below.
do $storage_policy_guard$
begin
  if to_regclass('storage.objects') is not null then
    execute $policy$
      drop policy if exists "Staff update editorial media" on storage.objects
    $policy$;
    execute $policy$
      drop policy if exists "Owners and admins delete editorial media"
        on storage.objects
    $policy$;
    execute $policy$
      drop policy if exists "Owner delete prepared editorial media"
        on storage.objects
    $policy$;
    execute $policy$
      create policy "Owner delete prepared editorial media"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'editorial-media'
        and public.is_staff(array['owner'::public.staff_role])
        and exists (
          select 1
          from public.media_assets asset
          where asset.bucket = storage.objects.bucket_id
            and asset.object_path = storage.objects.name
            and asset.purge_token is not null
            and asset.purge_requested_at is not null
            and asset.purge_requested_by = (select auth.uid())
        )
      )
    $policy$;

    -- The upload route stores the immutable object before inserting metadata.
    -- If that insert fails, permit only the same authenticated uploader to
    -- remove the fresh, canonical orphan. Metadata-backed objects are excluded.
    execute $policy$
      drop policy if exists "Uploader delete fresh orphan editorial media"
        on storage.objects
    $policy$;
    execute $policy$
      create policy "Uploader delete fresh orphan editorial media"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'editorial-media'
        and public.is_staff()
        and owner_id = (select auth.uid())::text
        and created_at >= now() - interval '10 minutes'
        and name ~ '^[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
        and not exists (
          select 1
          from public.media_assets asset
          where asset.bucket = storage.objects.bucket_id
            and asset.object_path = storage.objects.name
        )
      )
    $policy$;
  end if;
end;
$storage_policy_guard$;

-- Keep the fail-closed admin health contract synchronized with the Media
-- Studio lifecycle. A partial migration must never look production-ready.
create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then jsonb_build_object(
      'version', '20260830_media_studio_lifecycle',
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
      ),
      'mediaStudioLifecycle',
        to_regtype('public.media_rights_status') is not null
        and to_regprocedure(
          'public.list_media_studio_assets(text,text,text,integer,integer)'
        ) is not null
        and to_regprocedure(
          'public.trash_media_asset(uuid,timestamptz)'
        ) is not null
        and to_regprocedure(
          'public.restore_media_asset(uuid,timestamptz)'
        ) is not null
        and to_regprocedure(
          'public.prepare_media_asset_purge(uuid,timestamptz)'
        ) is not null
        and to_regprocedure(
          'public.finalize_media_asset_purge(uuid,uuid,timestamptz)'
        ) is not null
        and to_regprocedure(
          'public.cancel_media_asset_purge(uuid,uuid,timestamptz)'
        ) is not null
        and (
          select count(*) = 10
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'media_assets'
            and column_name in (
              'rights_status',
              'sha256_hex',
              'deleted_by',
              'replacement_of_media_id',
              'replaced_by_media_id',
              'replacement_registered_at',
              'replacement_registered_by',
              'purge_token',
              'purge_requested_at',
              'purge_requested_by'
            )
        )
        and not has_table_privilege(
          'authenticated', 'public.media_assets', 'DELETE'
        )
        and not has_table_privilege(
          'authenticated', 'public.media_assets', 'INSERT'
        )
        and has_column_privilege(
          'authenticated', 'public.media_assets', 'sha256_hex', 'INSERT'
        )
        and not has_column_privilege(
          'authenticated', 'public.media_assets', 'deleted_by', 'INSERT'
        )
        and not has_column_privilege(
          'authenticated', 'public.media_assets',
          'replacement_of_media_id', 'INSERT'
        )
        and not has_column_privilege(
          'authenticated', 'public.media_assets',
          'replaced_by_media_id', 'INSERT'
        )
        and not has_column_privilege(
          'authenticated', 'public.media_assets',
          'replacement_registered_at', 'INSERT'
        )
        and not has_column_privilege(
          'authenticated', 'public.media_assets',
          'replacement_registered_by', 'INSERT'
        )
        and not exists (
          select 1
          from pg_catalog.pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and policyname in (
              'Staff update editorial media',
              'Owners and admins delete editorial media'
            )
        )
        and exists (
          select 1 from pg_catalog.pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Owner delete prepared editorial media'
            and cmd = 'DELETE'
            and roles = array['authenticated'::name]
            and position('purge_token' in coalesce(qual, '')) > 0
            and position('purge_requested_by' in coalesce(qual, '')) > 0
            and position('editorial-media' in coalesce(qual, '')) > 0
        )
        and exists (
          select 1 from pg_catalog.pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Uploader delete fresh orphan editorial media'
            and cmd = 'DELETE'
            and roles = array['authenticated'::name]
            and position('owner_id' in coalesce(qual, '')) > 0
            and position('00:10:00' in coalesce(qual, '')) > 0
            and position('media_assets' in coalesce(qual, '')) > 0
            and position('.webp' in coalesce(qual, '')) > 0
        ),
      'mediaUsageGraph',
        to_regprocedure(
          'public.editor_media_ids_from_json(jsonb)'
        ) is not null
        and to_regprocedure(
          'public.editor_media_ids_from_html(text)'
        ) is not null
        and to_regprocedure(
          'public.editor_media_refs_from_json(jsonb)'
        ) is not null
        and to_regprocedure(
          'public.editor_media_refs_from_html(text)'
        ) is not null
        and to_regprocedure(
          'public.normalize_editor_media_source_url(text)'
        ) is not null
        and to_regprocedure(
          'public.editor_media_identity_sets_match(jsonb,text)'
        ) is not null
        and to_regprocedure(
          'public.guard_active_direct_media_refs_trigger()'
        ) is not null
        and to_regprocedure(
          'public.guard_pending_purge_snapshot_refs_trigger()'
        ) is not null
        and to_regprocedure(
          'public.sync_media_usages(text,uuid,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.list_media_asset_usages(uuid[])'
        ) is not null
        and (
          select count(*) = 6
          from pg_catalog.pg_trigger media_trigger
          join pg_catalog.pg_class relation
            on relation.oid = media_trigger.tgrelid
          join pg_catalog.pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and not media_trigger.tgisinternal
            and media_trigger.tgfoid =
              'public.sync_editor_media_usage_trigger()'::regprocedure
            and media_trigger.tgname = any(array[
              'articles_sync_editor_media_usage',
              'articles_delete_editor_media_usage',
              'article_translations_sync_editor_media_usage',
              'article_translations_delete_editor_media_usage',
              'pages_sync_editor_media_usage',
              'pages_delete_editor_media_usage'
            ]::name[])
        )
        and (
          select count(*) = 3
          from pg_catalog.pg_trigger media_trigger
          join pg_catalog.pg_class relation
            on relation.oid = media_trigger.tgrelid
          join pg_catalog.pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and not media_trigger.tgisinternal
            and media_trigger.tgfoid =
              'public.guard_active_direct_media_refs_trigger()'::regprocedure
            and media_trigger.tgname = any(array[
              'articles_guard_active_direct_media_refs',
              'homepage_blocks_guard_active_direct_media_refs',
              'banners_guard_active_direct_media_refs'
            ]::name[])
        )
        and (
          select count(*) = 6
          from pg_catalog.pg_trigger media_trigger
          where not media_trigger.tgisinternal
            and media_trigger.tgfoid =
              'public.guard_pending_purge_snapshot_refs_trigger()'::regprocedure
            and media_trigger.tgname = any(array[
              'article_revisions_guard_pending_media_purge',
              'article_translation_revisions_guard_pending_media_purge',
              'page_revisions_guard_pending_media_purge',
              'homepage_block_revisions_guard_pending_media_purge',
              'site_chrome_revisions_guard_pending_media_purge',
              'editor_autosaves_guard_pending_media_purge'
            ]::name[])
        )
        and not has_table_privilege(
          'authenticated', 'public.media_usages', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.media_usages', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.media_usages', 'DELETE'
        )
        and has_table_privilege(
          'authenticated', 'public.media_usages', 'SELECT'
        )
        and exists (
          select 1
          from pg_catalog.pg_policies usage_policy
          where usage_policy.schemaname = 'public'
            and usage_policy.tablename = 'media_usages'
            and usage_policy.policyname = 'Staff read media usage'
            and usage_policy.cmd = 'SELECT'
            and usage_policy.roles = array['authenticated'::name]
            and position('is_staff' in coalesce(usage_policy.qual, '')) > 0
        )
        and not has_function_privilege(
          'authenticated',
          'public.sync_media_usages(text,uuid,jsonb)',
          'EXECUTE'
        ),
      'mediaSafeReplaceRpc',
        to_regprocedure(
          'public.preview_media_asset_replacement(uuid,uuid)'
        ) is not null
        and to_regprocedure(
          'public.replace_media_asset_current_usages(uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,boolean,text,text)'
        ) is not null
        and to_regprocedure(
          'public.replace_editor_media_html(text,uuid,uuid,text)'
        ) is not null
        and not has_function_privilege(
          'authenticated',
          'public.register_media_replacement(uuid,uuid,timestamptz,timestamptz)',
          'EXECUTE'
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health() from public;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
