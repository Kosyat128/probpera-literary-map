-- Phase 8: atomic, fail-closed mutation boundaries for Site Copy, redirects,
-- and comment moderation. Existing public read contracts remain unchanged.

create or replace function public.save_site_copy_block(
  p_expected_updated_at timestamptz,
  p_payload jsonb,
  p_audit_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  block_id uuid;
  current_updated_at timestamptz;
begin
  perform pg_advisory_xact_lock(188654771, 2);
  if actor_user_id is null or not public.is_staff() then
    raise exception using errcode = 'P0001', message = 'ADMIN_STAFF_REQUIRED';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or p_payload #>> '{settings,systemKey}' <> 'site-copy-overrides'
    or p_payload ->> 'block_type' <> 'text' then
    raise exception using errcode = 'P0001', message = 'SITE_COPY_INVALID_PAYLOAD';
  end if;

  select id, updated_at into block_id, current_updated_at
  from public.homepage_blocks
  where settings @> '{"systemKey":"site-copy-overrides"}'::jsonb
  order by updated_at desc
  limit 1
  for update;

  if block_id is not null then
    if p_expected_updated_at is null
      or current_updated_at <> p_expected_updated_at then
      raise exception using errcode = 'P0001', message = 'SITE_COPY_WRITE_CONFLICT';
    end if;
    update public.homepage_blocks
    set block_type = p_payload ->> 'block_type',
        title = p_payload ->> 'title',
        settings = p_payload -> 'settings',
        display_order = (p_payload ->> 'display_order')::integer,
        is_enabled = (p_payload ->> 'is_enabled')::boolean,
        background_style = p_payload ->> 'background_style',
        background_media_id = nullif(p_payload ->> 'background_media_id', '')::uuid,
        updated_by = actor_user_id
    where id = block_id;
  else
    if p_expected_updated_at is not null then
      raise exception using errcode = 'P0001', message = 'SITE_COPY_WRITE_CONFLICT';
    end if;
    insert into public.homepage_blocks (
      block_type, title, settings, display_order, is_enabled,
      background_style, background_media_id, updated_by
    ) values (
      p_payload ->> 'block_type',
      p_payload ->> 'title',
      p_payload -> 'settings',
      (p_payload ->> 'display_order')::integer,
      (p_payload ->> 'is_enabled')::boolean,
      p_payload ->> 'background_style',
      nullif(p_payload ->> 'background_media_id', '')::uuid,
      actor_user_id
    ) returning id into block_id;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_user_id,
    case when coalesce((p_audit_metadata ->> 'inline_editor')::boolean, false)
      then 'site_copy.inline_updated' else 'site_copy.updated' end,
    'site_copy', block_id::text,
    coalesce(p_audit_metadata, '{}'::jsonb) || jsonb_build_object('storage', 'homepage_blocks')
  );
  return block_id;
exception
  when invalid_text_representation or numeric_value_out_of_range or not_null_violation
    or check_violation then
    raise exception using errcode = 'P0001', message = 'SITE_COPY_INVALID_PAYLOAD';
end;
$$;

-- Keep ordinary homepage blocks editable through their existing staff flows,
-- but make the singleton Site Copy row writable only by the security-definer
-- RPC above. Restrictive policies compose with the existing permissive staff
-- policy and protect both the old and proposed row on UPDATE.
drop policy if exists "Site Copy insert requires guarded RPC"
  on public.homepage_blocks;
create policy "Site Copy insert requires guarded RPC"
on public.homepage_blocks as restrictive for insert to authenticated
with check (
  coalesce(settings #>> '{systemKey}', '') <> 'site-copy-overrides'
);

drop policy if exists "Site Copy update requires guarded RPC"
  on public.homepage_blocks;
create policy "Site Copy update requires guarded RPC"
on public.homepage_blocks as restrictive for update to authenticated
using (
  coalesce(settings #>> '{systemKey}', '') <> 'site-copy-overrides'
)
with check (
  coalesce(settings #>> '{systemKey}', '') <> 'site-copy-overrides'
);

drop policy if exists "Site Copy delete requires guarded RPC"
  on public.homepage_blocks;
create policy "Site Copy delete requires guarded RPC"
on public.homepage_blocks as restrictive for delete to authenticated
using (
  coalesce(settings #>> '{systemKey}', '') <> 'site-copy-overrides'
);

create or replace function public.assert_redirect_candidate(
  p_id uuid,
  p_source_path text,
  p_destination_path text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := regexp_replace(p_source_path, '/+$', '');
  normalized_destination text := case
    when p_destination_path like '/%' then regexp_replace(p_destination_path, '/+$', '')
    else p_destination_path
  end;
begin
  normalized_source := case when normalized_source = '' then '/' else normalized_source end;
  normalized_destination := case when normalized_destination = '' then '/' else normalized_destination end;
  if char_length(normalized_source) > 500
    or char_length(normalized_destination) > 500
    or normalized_source !~ '^/(?:$|[^/\\])'
    or normalized_source ~ '[[:cntrl:]\\]'
    or not (
      normalized_destination ~ '^/(?:$|[^/\\])'
      or normalized_destination ~ '^https://[^/[:space:]]+(?:/.*)?$'
    )
    or normalized_destination ~ '[[:cntrl:]\\]' then
    raise exception using errcode = 'P0001', message = 'REDIRECT_INVALID_PATH';
  end if;
  if normalized_source = normalized_destination then
    raise exception using errcode = 'P0001', message = 'REDIRECT_SELF_REFERENCE';
  end if;

  if p_is_active and exists (
    select 1 from public.redirects r
    where r.id is distinct from p_id and r.is_active
      and (
        r.source_path = normalized_source
        or (normalized_destination like '/%' and r.source_path = normalized_destination)
        or r.destination_path = normalized_source
      )
  ) then
    raise exception using errcode = 'P0001', message = 'REDIRECT_COLLISION_OR_CHAIN';
  end if;

  if p_is_active and exists (
    select 1 from public.pages p
    where p.deleted_at is null and p.status = 'published'
      and (
        '/stranitsy/' || p.slug = normalized_source
        or regexp_replace(
          regexp_replace(coalesce(p.canonical_url, ''), '^https://[^/]+', ''),
          '/+$', ''
        ) = normalized_source
      )
  ) then
    raise exception using errcode = 'P0001', message = 'REDIRECT_LIVE_ROUTE_COLLISION';
  end if;

  if p_is_active and exists (
    select 1 from public.articles a
    where a.deleted_at is null and a.status = 'published'
      and regexp_replace(
        regexp_replace(coalesce(a.canonical_url, ''), '^https://[^/]+', ''),
        '/+$', ''
      ) = normalized_source
  ) then
    raise exception using errcode = 'P0001', message = 'REDIRECT_LIVE_ROUTE_COLLISION';
  end if;
end;
$$;

create or replace function public.create_seo_redirect_guarded(
  p_source_path text,
  p_destination_path text,
  p_status_code smallint,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  redirect_id uuid;
begin
  perform pg_advisory_xact_lock(188654771, 3);
  if actor_user_id is null or not public.is_staff() then
    raise exception using errcode = 'P0001', message = 'ADMIN_STAFF_REQUIRED';
  end if;
  if p_status_code not in (301, 302, 307, 308) then
    raise exception using errcode = 'P0001', message = 'REDIRECT_INVALID_STATUS';
  end if;
  perform public.assert_redirect_candidate(null, p_source_path, p_destination_path, p_is_active);
  insert into public.redirects (
    source_path, destination_path, status_code, is_active, created_by
  ) values (
    coalesce(nullif(regexp_replace(p_source_path, '/+$', ''), ''), '/'),
    case when p_destination_path like '/%' then coalesce(nullif(regexp_replace(p_destination_path, '/+$', ''), ''), '/') else p_destination_path end,
    p_status_code, p_is_active, actor_user_id
  ) returning id into redirect_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor_user_id, 'redirect.created', 'redirect', redirect_id::text,
    jsonb_build_object('sourcePath', p_source_path, 'destinationPath', p_destination_path,
      'statusCode', p_status_code, 'isActive', p_is_active));
  return redirect_id;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'REDIRECT_SOURCE_EXISTS';
end;
$$;

create or replace function public.update_seo_redirect_guarded(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_source_path text,
  p_destination_path text,
  p_status_code smallint,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  current_updated_at timestamptz;
begin
  perform pg_advisory_xact_lock(188654771, 3);
  if actor_user_id is null or not public.is_staff() then
    raise exception using errcode = 'P0001', message = 'ADMIN_STAFF_REQUIRED';
  end if;
  select updated_at into current_updated_at from public.redirects where id = p_id for update;
  if current_updated_at is null or current_updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'REDIRECT_WRITE_CONFLICT';
  end if;
  if p_status_code not in (301, 302, 307, 308) then
    raise exception using errcode = 'P0001', message = 'REDIRECT_INVALID_STATUS';
  end if;
  perform public.assert_redirect_candidate(p_id, p_source_path, p_destination_path, p_is_active);
  update public.redirects set
    source_path = coalesce(nullif(regexp_replace(p_source_path, '/+$', ''), ''), '/'),
    destination_path = case when p_destination_path like '/%' then coalesce(nullif(regexp_replace(p_destination_path, '/+$', ''), ''), '/') else p_destination_path end,
    status_code = p_status_code,
    is_active = p_is_active
  where id = p_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor_user_id, 'redirect.updated', 'redirect', p_id::text,
    jsonb_build_object('sourcePath', p_source_path, 'destinationPath', p_destination_path,
      'statusCode', p_status_code, 'isActive', p_is_active));
  return p_id;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'REDIRECT_SOURCE_EXISTS';
end;
$$;

create or replace function public.delete_seo_redirect_guarded(
  p_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  current_updated_at timestamptz;
begin
  perform pg_advisory_xact_lock(188654771, 3);
  if actor_user_id is null
    or not public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role]) then
    raise exception using errcode = 'P0001', message = 'ADMIN_HIGH_RISK_ROLE_REQUIRED';
  end if;
  select updated_at into current_updated_at from public.redirects where id = p_id for update;
  if current_updated_at is null or current_updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'REDIRECT_WRITE_CONFLICT';
  end if;
  delete from public.redirects where id = p_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id)
  values (actor_user_id, 'redirect.deleted', 'redirect', p_id::text);
  return p_id;
end;
$$;

drop policy if exists "Staff manage redirects" on public.redirects;
drop policy if exists "Staff read redirects" on public.redirects;
create policy "Staff read redirects" on public.redirects for select to authenticated
using (public.is_staff());
revoke insert, update, delete on table public.redirects from public, anon, authenticated;
grant select on table public.redirects to anon, authenticated;

create or replace function public.moderate_comments_guarded(
  p_items jsonb,
  p_status public.publication_status
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  requested_count integer;
  updated_count integer;
begin
  perform pg_advisory_xact_lock(188654771, 4);
  if actor_user_id is null or not public.is_staff() then
    raise exception using errcode = 'P0001', message = 'ADMIN_STAFF_REQUIRED';
  end if;
  if p_status not in ('published'::public.publication_status, 'hidden'::public.publication_status)
    or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'COMMENT_INVALID_INPUT';
  end if;
  select count(*), count(distinct item.id)
    into requested_count, updated_count
  from (
    select (value ->> 'id')::uuid as id
    from jsonb_array_elements(p_items)
  ) item;
  if requested_count < 1 or requested_count > 100 or requested_count <> updated_count then
    raise exception using errcode = 'P0001', message = 'COMMENT_INVALID_INPUT';
  end if;

  with requested as (
    select (value ->> 'id')::uuid as id,
      (value ->> 'updatedAt')::timestamptz as updated_at
    from jsonb_array_elements(p_items)
  ), locked as (
    select c.id
    from public.article_comments c join requested r on r.id = c.id
    order by c.id
    for update
  ), changed as (
    update public.article_comments c
    set status = p_status, updated_at = now()
    from requested r
    where c.id = r.id and c.updated_at = r.updated_at
    returning c.id
  )
  select count(*) into updated_count from changed;

  if updated_count <> requested_count then
    raise exception using errcode = 'P0001', message = 'COMMENT_WRITE_CONFLICT';
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id)
  select actor_user_id, 'comment.' || p_status::text, 'comment', value ->> 'id'
  from jsonb_array_elements(p_items);
  return updated_count;
exception when invalid_text_representation or datetime_field_overflow then
  raise exception using errcode = 'P0001', message = 'COMMENT_INVALID_INPUT';
end;
$$;

-- Readers may still correct the body of their own comment. Status moderation,
-- identity fields and timestamps are no longer directly writable through the
-- authenticated API; the guarded RPC and existing security-definer community
-- functions retain their complete transactional access.
drop policy if exists "Authors manage their comments"
  on public.article_comments;
create policy "Authors manage their comments"
on public.article_comments for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

revoke update, delete on table public.article_comments
  from public, anon, authenticated;
revoke update (
  id, article_slug, parent_id, author_id, guest_name, session_id,
  body, status, created_at, updated_at
) on table public.article_comments from public, anon, authenticated;
grant update (body) on table public.article_comments to authenticated;

drop trigger if exists article_comments_set_updated_at
  on public.article_comments;
create trigger article_comments_set_updated_at
  before update on public.article_comments
  for each row execute function public.set_updated_at();

revoke all on function public.save_site_copy_block(timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.assert_redirect_candidate(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.create_seo_redirect_guarded(text, text, smallint, boolean) from public, anon, authenticated;
revoke all on function public.update_seo_redirect_guarded(uuid, timestamptz, text, text, smallint, boolean) from public, anon, authenticated;
revoke all on function public.delete_seo_redirect_guarded(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.moderate_comments_guarded(jsonb, public.publication_status) from public, anon, authenticated;
grant execute on function public.save_site_copy_block(timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.create_seo_redirect_guarded(text, text, smallint, boolean) to authenticated;
grant execute on function public.update_seo_redirect_guarded(uuid, timestamptz, text, text, smallint, boolean) to authenticated;
grant execute on function public.delete_seo_redirect_guarded(uuid, timestamptz) to authenticated;
grant execute on function public.moderate_comments_guarded(jsonb, public.publication_status) to authenticated;
