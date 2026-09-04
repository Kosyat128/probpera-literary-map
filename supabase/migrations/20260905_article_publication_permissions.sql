-- Keep public save/promotion SECURITY INVOKER and both protected tables read-only
-- to authenticated clients. Only the existing guarded operations may write.

create or replace function public.lock_article_working_draft_for_publication(
  p_article_id uuid,
  p_expected_article_updated_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_article_updated_at timestamptz;
  current_draft_version bigint;
begin
  if (select auth.uid()) is null
    or not public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role]) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  if p_article_id is null or p_expected_article_updated_at is null then
    raise exception using errcode = '22023', message = 'PROMOTION_INPUT_INVALID';
  end if;

  -- Match the save/promotion lock order even when this helper is called directly.
  select article.updated_at into current_article_updated_at
  from public.articles article
  where article.id = p_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ARTICLE_NOT_FOUND';
  end if;
  if current_article_updated_at is distinct from p_expected_article_updated_at then
    raise exception using errcode = '40001', message = 'ARTICLE_CONFLICT';
  end if;

  select draft.version into current_draft_version
  from public.article_working_drafts draft
  where draft.article_id = p_article_id
  for update;
  return current_draft_version;
end;
$$;

revoke all on function public.lock_article_working_draft_for_publication(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.lock_article_working_draft_for_publication(uuid, timestamptz)
  to authenticated;

create or replace function public.upsert_article_redirect_guarded(
  p_source_path text,
  p_destination_path text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_redirect_id uuid;
  existing_updated_at timestamptz;
  normalized_source text := coalesce(nullif(regexp_replace(p_source_path, '/+$', ''), ''), '/');
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  -- Share the SEO RPC lock before reading its CAS token. Never use a direct
  -- INSERT/UPDATE or SELECT FOR UPDATE on the read-only redirects table.
  perform pg_advisory_xact_lock(188654771, 3);
  select redirect.id, redirect.updated_at
  into existing_redirect_id, existing_updated_at
  from public.redirects redirect
  where redirect.source_path = normalized_source;
  if found then
    return public.update_seo_redirect_guarded(
      existing_redirect_id, existing_updated_at,
      p_source_path, p_destination_path, 301::smallint, true
    );
  end if;
  return public.create_seo_redirect_guarded(
    p_source_path, p_destination_path, 301::smallint, true
  );
end;
$$;

revoke all on function public.upsert_article_redirect_guarded(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_article_redirect_guarded(text, text)
  to authenticated;

-- Replace only the two reviewed statements. Fail closed on an unexpected
-- predecessor; retain every original role, payload, CAS, RLS and atomicity gate.
do $publication_permissions$
declare
  promotion_oid regprocedure := to_regprocedure(
    'public.promote_article_working_draft(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'
  );
  bundle_oid regprocedure := to_regprocedure(
    'public.save_article_bundle(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'
  );
  definition text;
  old_lock text := $old_lock$  select draft.version
  into current_draft_version
  from public.article_working_drafts draft
  where draft.article_id = p_article_id
  for update;
  has_working_draft := found;$old_lock$;
  new_lock text := $new_lock$  current_draft_version := public.lock_article_working_draft_for_publication(
    p_article_id, p_expected_article_updated_at
  );
  has_working_draft := current_draft_version is not null;$new_lock$;
  old_redirect text := $old_redirect$    insert into public.redirects (
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
      created_by = actor_id;$old_redirect$;
  new_redirect text := $new_redirect$    perform public.upsert_article_redirect_guarded(
      p_redirect_source_path, p_redirect_destination_path
    );$new_redirect$;
begin
  if promotion_oid is null or bundle_oid is null
    or exists (select 1 from pg_proc where oid in (promotion_oid, bundle_oid) and prosecdef) then
    raise exception 'Expected SECURITY INVOKER article publication functions are missing';
  end if;

  definition := pg_get_functiondef(promotion_oid);
  if strpos(definition, old_lock) > 0 and strpos(definition, new_lock) = 0
    and (length(definition) - length(replace(definition, old_lock, ''))) = length(old_lock) then
    execute replace(definition, old_lock, new_lock);
  elsif strpos(definition, old_lock) > 0 or strpos(definition, new_lock) = 0 then
    raise exception 'Unexpected article promotion lock predecessor';
  end if;

  definition := pg_get_functiondef(bundle_oid);
  if strpos(definition, old_redirect) > 0 and strpos(definition, new_redirect) = 0
    and (length(definition) - length(replace(definition, old_redirect, ''))) = length(old_redirect) then
    execute replace(definition, old_redirect, new_redirect);
  elsif strpos(definition, old_redirect) > 0 or strpos(definition, new_redirect) = 0 then
    raise exception 'Unexpected article redirect write predecessor';
  end if;

  if exists (
    select 1 from pg_proc where oid in (promotion_oid, bundle_oid) and prosecdef
  ) or not (
    select prosecdef from pg_proc
    where oid = 'public.lock_article_working_draft_for_publication(uuid,timestamptz)'::regprocedure
  ) or (
    select prosecdef from pg_proc
    where oid = 'public.upsert_article_redirect_guarded(text,text)'::regprocedure
  ) then
    raise exception 'Article publication privilege boundaries changed';
  end if;
  if has_table_privilege('authenticated', 'public.article_working_drafts', 'INSERT,UPDATE,DELETE')
    or has_any_column_privilege('authenticated', 'public.article_working_drafts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.redirects', 'INSERT,UPDATE,DELETE')
    or has_any_column_privilege('authenticated', 'public.redirects', 'UPDATE') then
    raise exception 'Protected article tables must remain read-only to authenticated clients';
  end if;
  if not has_function_privilege('authenticated',
      'public.lock_article_working_draft_for_publication(uuid,timestamptz)', 'EXECUTE')
    or not has_function_privilege('authenticated',
      'public.upsert_article_redirect_guarded(text,text)', 'EXECUTE')
    or has_function_privilege('anon',
      'public.lock_article_working_draft_for_publication(uuid,timestamptz)', 'EXECUTE')
    or has_function_privilege('service_role',
      'public.lock_article_working_draft_for_publication(uuid,timestamptz)', 'EXECUTE')
    or has_function_privilege('anon',
      'public.upsert_article_redirect_guarded(text,text)', 'EXECUTE')
    or has_function_privilege('service_role',
      'public.upsert_article_redirect_guarded(text,text)', 'EXECUTE') then
    raise exception 'Article publication helper ACLs are invalid';
  end if;
end;
$publication_permissions$;
