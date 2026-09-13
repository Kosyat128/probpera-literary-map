-- Initialize only absent foreign-key references needed by the checked staged
-- target. Existing editorial rows, including manual labels, are never changed.
-- The reviewed Stowe and draft Alcott helpers retain their separate proof gates.
create or replace function public.prepare_literary_archive_editorial_references_20260914(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  payload_sha constant text := 'df634b2a54d67df1fbd46b5cda33ddff926a337630bb6246290ff06e33b25c0b';
  target public.literary_archive_releases%rowtype;
  envelope jsonb;
  catalog jsonb;
  country_catalog jsonb;
  writer_catalog jsonb;
  required_writers jsonb;
  required_countries jsonb;
  reference jsonb;
  country_key text;
  writer_key text;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    or current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on' then
    raise exception 'Editorial references require the atomic archive commit' using errcode = '42501';
  end if;
  select * into target from public.literary_archive_releases where id = p_release_id;
  if not found or target.status is distinct from 'staging'
    or target.expected_item_count < 1
    or target.expected_item_count <> (select count(*) from public.literary_archive_release_items where release_id = target.id) then
    raise exception 'Editorial references require the complete staged target' using errcode = '23514';
  end if;
  envelope := target.metadata -> 'referenceCatalog';
  if jsonb_typeof(envelope) is distinct from 'object'
    or (envelope - array['contract','payloadSha256','payloadText']) <> '{}'::jsonb
    or envelope ->> 'contract' is distinct from 'literary-archive-reference-catalog-20260914'
    or envelope ->> 'payloadSha256' is distinct from payload_sha
    or jsonb_typeof(envelope -> 'payloadText') is distinct from 'string'
    or public.literary_work_evidence_v2_sha256(envelope ->> 'payloadText') is distinct from payload_sha then
    raise exception 'Editorial reference catalog is not the exact reviewed payload' using errcode = '23514';
  end if;
  catalog := (envelope ->> 'payloadText')::jsonb;
  if jsonb_typeof(catalog) is distinct from 'object'
    or (catalog - array['countries','writers']) <> '{}'::jsonb
    or jsonb_typeof(catalog -> 'countries') is distinct from 'array'
    or jsonb_typeof(catalog -> 'writers') is distinct from 'array' then
    raise exception 'Editorial reference catalog has an invalid shape' using errcode = '23514';
  end if;
  select jsonb_object_agg(entry ->> 'id',entry) into country_catalog
  from jsonb_array_elements(catalog -> 'countries') entry;
  select jsonb_object_agg((entry ->> 'countryId') || ':' || (entry ->> 'id'),entry) into writer_catalog
  from jsonb_array_elements(catalog -> 'writers') entry;
  if (select count(*) from jsonb_object_keys(country_catalog)) <> jsonb_array_length(catalog -> 'countries')
    or (select count(*) from jsonb_object_keys(writer_catalog)) <> jsonb_array_length(catalog -> 'writers') then
    raise exception 'Editorial reference catalog has duplicate identities' using errcode = '23514';
  end if;
  if exists(select 1 from public.literary_archive_release_items item where item.release_id = target.id
    and (jsonb_typeof(item.payload -> 'authors') is distinct from 'array'
      or item.payload_sha256 is distinct from public.literary_work_evidence_v2_sha256(item.canonical_payload)
      or item.payload is distinct from item.canonical_payload::jsonb)) then
    raise exception 'Editorial references require intact staged payloads' using errcode = '23514';
  end if;

  -- Linked author references have the same FK regardless of attribution status.
  -- A fully unlinked credit does not create a new writer identity.
  select coalesce(jsonb_agg(jsonb_build_object('countryId',country_id,'id',writer_id)
    order by country_id collate "C", writer_id collate "C"),'[]'::jsonb)
  into required_writers
  from (
    select item.payload #>> '{work,country_id}' as country_id,
      item.payload #>> '{work,writer_id}' as writer_id
    from public.literary_archive_release_items item where item.release_id = target.id
    union
    select author ->> 'writer_country_id', author ->> 'writer_id'
    from public.literary_archive_release_items item
    cross join lateral jsonb_array_elements(item.payload -> 'authors') author
    where item.release_id = target.id
      and (author ->> 'writer_country_id' is not null or author ->> 'writer_id' is not null)
  ) needed;
  if exists(select 1 from jsonb_array_elements(required_writers) needed
    where needed ->> 'countryId' is null or needed ->> 'id' is null
      or needed ->> 'countryId' !~ '^[a-z0-9][a-z0-9_-]*$'
      or needed ->> 'id' ~ '[[:space:][:cntrl:]/:]'
      or char_length(needed ->> 'id') not between 2 and 180
      or not writer_catalog ? ((needed ->> 'countryId') || ':' || (needed ->> 'id'))) then
    raise exception 'Staged writer reference is outside the reviewed catalog' using errcode = '23514';
  end if;
  select jsonb_agg(country_id order by country_id collate "C") into required_countries
  from (select distinct value ->> 'countryId' as country_id from jsonb_array_elements(required_writers)) needed;
  if exists(select 1 from jsonb_array_elements_text(required_countries) needed(country_id)
    where not country_catalog ? needed.country_id) then
    raise exception 'Staged country reference is outside the reviewed catalog' using errcode = '23514';
  end if;

  -- Country then writer is the ordinary reference-editor lock order. NOWAIT
  -- aborts a conflicting publication without waiting against interactive edits.
  lock table public.editorial_countries, public.editorial_writers
    in share row exclusive mode nowait;
  if exists(select 1 from public.editorial_countries existing
    join jsonb_array_elements_text(required_countries) needed(country_id) on existing.id = needed.country_id
    where existing.status is distinct from 'active') then
    raise exception 'Required editorial country is archived' using errcode = '23514';
  end if;
  if exists(select 1 from public.editorial_writers existing
    join jsonb_array_elements(required_writers) needed
      on existing.country_id = needed ->> 'countryId' and existing.id = needed ->> 'id'
    where existing.status is distinct from 'active') then
    raise exception 'Required editorial writer is archived' using errcode = '23514';
  end if;

  for country_key in select value from jsonb_array_elements_text(required_countries) loop
    if not exists(select 1 from public.editorial_countries where id = country_key) then
      reference := country_catalog -> country_key;
      insert into public.editorial_countries(id,name_ru,name_en,iso_code,source,metadata)
      values(country_key,reference ->> 'nameRu',reference ->> 'nameEn',nullif(reference ->> 'isoCode',''),
        'editorial-catalog',jsonb_build_object('referenceCatalogContract',envelope ->> 'contract','referenceCatalogSha256',payload_sha));
    end if;
  end loop;
  for reference in select writer_catalog -> ((needed ->> 'countryId') || ':' || (needed ->> 'id'))
    from jsonb_array_elements(required_writers) needed loop
    country_key := reference ->> 'countryId';
    writer_key := reference ->> 'id';
    -- These two rows can be inserted only by the unchanged staged-proof helpers.
    if country_key = 'usa' and writer_key in ('harriet_beecher_stowe','louisa_may_alcott') then continue; end if;
    if not exists(select 1 from public.editorial_writers where country_id = country_key and id = writer_key) then
      insert into public.editorial_writers(country_id,id,name_ru,name_en,source,metadata)
      values(country_key,writer_key,reference ->> 'nameRu',reference ->> 'nameEn','editorial-catalog',
        jsonb_build_object('referenceCatalogContract',envelope ->> 'contract','referenceCatalogSha256',payload_sha));
    end if;
  end loop;
end;
$$;

revoke all on function public.prepare_literary_archive_editorial_references_20260914(uuid)
  from public, anon, authenticated, service_role;

-- Preserve the published commit's OID, ACL, hashes, idempotence and lock guards.
-- The initializer runs after transport/live validation, before both writer gates.
do $literary_archive_editorial_reference_hook_20260914$
declare
  definition text;
  anchor text := '  perform public.prepare_literary_archive_registry_rotation(target.id);';
  hook text := '  perform public.prepare_literary_archive_editorial_references_20260914(target.id);';
begin
  select pg_catalog.pg_get_functiondef('public.commit_literary_archive_release(uuid,text)'::regprocedure) into definition;
  if position(hook in definition) = 0 then
    if (length(definition) - length(replace(definition,anchor,''))) / length(anchor) <> 1 then
      raise exception 'Atomic archive editorial reference boundary cannot be patched safely';
    end if;
    execute replace(definition,anchor,hook || E'\n' || anchor);
  elsif (length(definition) - length(replace(definition,hook,''))) / length(hook) <> 1
    or (length(definition) - length(replace(definition,anchor,''))) / length(anchor) <> 1
    or position(hook || E'\n' || anchor in definition) = 0 then
    raise exception 'Atomic archive editorial reference hook is partial or displaced';
  end if;
end;
$literary_archive_editorial_reference_hook_20260914$;
